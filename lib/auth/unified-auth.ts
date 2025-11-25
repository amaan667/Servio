/**
 * UNIFIED AUTHENTICATION, AUTHORIZATION, AND TIER SYSTEM
 * 
 * This is the SINGLE SOURCE OF TRUTH for all auth/role/tier checks.
 * 
 * Architecture:
 * 1. Middleware handles authentication (sets x-user-id header)
 * 2. This module handles authorization (venue access) and tier/role checks
 * 3. API routes use requireAuthAndVenueAccess() wrapper
 * 4. Pages handle tier checks server-side and pass to components
 * 5. Components NEVER do auth/tier checks - they just render based on props
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseServer } from "@/lib/supabase";
import { verifyVenueAccess, type AuthorizedContext } from "@/lib/middleware/authorization";
import { checkFeatureAccess, checkLimit, getUserTier, TIER_LIMITS } from "@/lib/tier-restrictions";
import { logger } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";

// ============================================================================
// TYPES
// ============================================================================

export interface AuthContext extends AuthorizedContext {
  tier: string;
}

export interface TierCheckResult {
  allowed: boolean;
  tier: string;
  requiredTier?: string;
  limit?: number;
  current?: number;
  message?: string;
}

// ============================================================================
// UNIFIED AUTHENTICATION & AUTHORIZATION
// ============================================================================

/**
 * Get authenticated user from request
 * Uses middleware-set header or falls back to session from cookies
 */
export async function getAuthUserFromRequest(
  request: NextRequest
): Promise<{ user: User | null; error: string | null }> {
  // Read cookies directly from the request (more reliable in API routes)
  const requestCookies = request.cookies;
  
  // Create supabase client using request cookies directly
  const supabase = supabaseServer({
    get: (name: string) => {
      try {
        return requestCookies.get(name)?.value;
      } catch {
        return undefined;
      }
    },
    set: () => {
      /* Empty - read-only mode */
    },
  });

  // Try to get session from request cookies
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      // Handle refresh token errors silently
      if (
        sessionError.message?.includes("refresh_token_not_found") ||
        sessionError.message?.includes("Invalid Refresh Token")
      ) {
        return { user: null, error: null };
      }
      logger.debug("[UNIFIED AUTH] Session error:", { error: sessionError.message });
      return { user: null, error: sessionError.message };
    }

    if (session?.user) {
      // Verify middleware header matches if it exists
      const middlewareUserId = request.headers.get("x-user-id");
      if (middlewareUserId && session.user.id !== middlewareUserId) {
        logger.warn("[UNIFIED AUTH] Middleware header doesn't match session user", {
          middlewareUserId,
          sessionUserId: session.user.id,
        });
      }
      return { user: session.user, error: null };
    }
  } catch (error) {
    logger.warn("[UNIFIED AUTH] Error reading session from request cookies", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback: Check middleware header if session read failed
  const middlewareUserId = request.headers.get("x-user-id");
  if (middlewareUserId) {
    logger.debug("[UNIFIED AUTH] Using middleware header as fallback", { userId: middlewareUserId });
    // Middleware already authenticated, but we need full user object
    // Try to get user using getUser() which might work even if getSession() failed
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (user && user.id === middlewareUserId) {
        return { user, error: null };
      }
      if (userError) {
        logger.debug("[UNIFIED AUTH] getUser() also failed", { error: userError.message });
      }
    } catch (error) {
      logger.debug("[UNIFIED AUTH] Error calling getUser()", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // No session found
  return { user: null, error: "No authentication found" };
}

/**
 * Unified auth + venue access check for API routes
 * This is the ONLY function API routes should use for auth
 */
export async function requireAuthAndVenueAccess(
  request: NextRequest,
  venueId: string | null | undefined
): Promise<
  | { success: true; context: AuthContext }
  | { success: false; response: NextResponse }
> {
  // 1. Authentication check
  const { user, error: authError } = await getAuthUserFromRequest(request);

  if (authError || !user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Unauthorized", message: authError || "Authentication required" },
        { status: 401 }
      ),
    };
  }

  // 2. Venue ID check
  if (!venueId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Bad Request", message: "venueId is required" },
        { status: 400 }
      ),
    };
  }

  // 3. Venue access check
  const access = await verifyVenueAccess(venueId, user.id);

  if (!access) {
    logger.warn("[UNIFIED AUTH] Venue access denied", {
      userId: user.id,
      venueId,
    });
    return {
      success: false,
      response: NextResponse.json(
        { error: "Forbidden", message: "Access denied to this venue" },
        { status: 403 }
      ),
    };
  }

  // 4. Get user tier
  const tier = await getUserTier(user.id);

  return {
    success: true,
    context: {
      venue: access.venue,
      user: access.user,
      role: access.role,
      venueId,
      tier,
    },
  };
}

// ============================================================================
// UNIFIED TIER & FEATURE CHECKS
// ============================================================================

/**
 * Check if user can access a feature (tier-based)
 * This is the ONLY function to use for feature access checks
 */
export async function checkFeatureAccessUnified(
  userId: string,
  feature: keyof import("@/lib/tier-restrictions").TierLimits["features"]
): Promise<TierCheckResult> {
  const result = await checkFeatureAccess(userId, feature);

  return {
    allowed: result.allowed,
    tier: result.currentTier,
    requiredTier: result.requiredTier,
    message: result.allowed
      ? undefined
      : `This feature requires ${result.requiredTier} tier. Current tier: ${result.currentTier}`,
  };
}

/**
 * Check if user can create more of a resource (limit-based)
 * This is the ONLY function to use for limit checks
 */
export async function checkResourceLimitUnified(
  userId: string,
  resourceType: "maxTables" | "maxMenuItems" | "maxStaff" | "maxVenues",
  currentCount: number
): Promise<TierCheckResult> {
  const result = await checkLimit(userId, resourceType, currentCount);

  return {
    allowed: result.allowed,
    tier: result.currentTier,
    limit: result.limit,
    current: currentCount,
    message: result.allowed
      ? undefined
      : `Limit reached: ${currentCount}/${result.limit}. Upgrade to add more.`,
  };
}

/**
 * Enforce feature access - returns error response if not allowed
 * Use this in API routes that require specific features
 */
export async function enforceFeatureAccess(
  userId: string,
  feature: keyof import("@/lib/tier-restrictions").TierLimits["features"]
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const check = await checkFeatureAccessUnified(userId, feature);

  if (!check.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Feature not available",
          message: check.message,
          currentTier: check.tier,
          requiredTier: check.requiredTier,
          upgradeRequired: true,
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true };
}

/**
 * Enforce resource limit - returns error response if limit exceeded
 * Use this in API routes that create resources
 */
export async function enforceResourceLimit(
  userId: string,
  resourceType: "maxTables" | "maxMenuItems" | "maxStaff" | "maxVenues",
  currentCount: number
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const check = await checkResourceLimitUnified(userId, resourceType, currentCount);

  if (!check.allowed) {
    const resourceName = resourceType.replace("max", "").toLowerCase();
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Limit reached",
          message: check.message,
          currentTier: check.tier,
          limit: check.limit,
          current: check.current,
          resource: resourceName,
          upgradeRequired: true,
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true };
}

// ============================================================================
// SERVER-SIDE PAGE HELPERS (for Next.js page components)
// ============================================================================

/**
 * Get user tier and feature access for server-side pages
 * Use this in page.tsx files to pass props to client components
 */
export async function getPageAuthContext(
  userId: string,
  venueId: string
): Promise<{
  tier: string;
  role: string;
  hasFeatureAccess: (feature: keyof import("@/lib/tier-restrictions").TierLimits["features"]) => boolean;
  venueAccess: boolean;
} | null> {
  try {
    // Get tier
    const tier = await getUserTier(userId);
    
    // Verify venue access
    const access = await verifyVenueAccess(venueId, userId);
    if (!access) {
      return null;
    }

    // Helper to check feature access (synchronous check using tier)
    const hasFeatureAccess = (feature: keyof import("@/lib/tier-restrictions").TierLimits["features"]): boolean => {
      const limits = TIER_LIMITS[tier];
      if (!limits) return false;
      
      const featureValue = limits.features[feature];
      // For boolean features, return the value directly
      if (typeof featureValue === "boolean") {
        return featureValue;
      }
      // For analytics and supportLevel, they're always allowed (just different levels)
      return true;
    };

    return {
      tier,
      role: access.role,
      hasFeatureAccess,
      venueAccess: true,
    };
  } catch (error) {
    logger.error("[UNIFIED AUTH] Error getting page auth context:", { error });
    return null;
  }
}

// ============================================================================
// ROLE CHECKS
// ============================================================================

/**
 * Check if user has specific role(s) in venue
 * Use this for role-based authorization
 */
export function hasRole(context: AuthContext, allowedRoles: string[]): boolean {
  return allowedRoles.includes(context.role);
}

/**
 * Check if user is owner
 */
export function isOwner(context: AuthContext): boolean {
  return context.role === "owner";
}

/**
 * Check if user is manager or owner
 */
export function isManagerOrOwner(context: AuthContext): boolean {
  return ["owner", "manager"].includes(context.role);
}

/**
 * Check if user is staff (any role)
 */
export function isStaff(context: AuthContext): boolean {
  return ["owner", "manager", "server"].includes(context.role);
}

// ============================================================================
// API ROUTE WRAPPER
// ============================================================================

/**
 * Unified wrapper for API routes
 * Handles auth + venue access + optional feature/role checks
 * 
 * Usage:
 * export const POST = withUnifiedAuth(
 *   async (req, context) => {
 *     // context has: venue, user, role, venueId, tier
 *     // Your route logic here
 *   },
 *   {
 *     requireFeature: "aiAssistant", // optional
 *     requireRole: ["owner", "manager"], // optional
 *   }
 * );
 */
export function withUnifiedAuth(
  handler: (req: NextRequest, context: AuthContext, routeParams?: { params?: Promise<Record<string, string>> }) => Promise<NextResponse>,
  options?: {
    requireFeature?: keyof import("@/lib/tier-restrictions").TierLimits["features"];
    requireRole?: string[];
    requireOwner?: boolean;
    extractVenueId?: (req: NextRequest, routeParams?: { params?: Promise<Record<string, string>> }) => Promise<string | null>;
  }
) {
  return async (req: NextRequest, routeParams?: { params?: Promise<Record<string, string>> }) => {
    try {
      // Extract venueId from params, query, or body
      let venueId: string | null = null;

      // Use custom extractor if provided
      if (options?.extractVenueId) {
        venueId = await options.extractVenueId(req, routeParams);
      } else {
        // Try params first (await if it's a Promise)
        if (routeParams?.params) {
          const params = await routeParams.params;
          venueId = params?.venueId || null;
        }

        // Try query string
        if (!venueId) {
          const url = new URL(req.url);
          venueId = url.searchParams.get("venueId") || url.searchParams.get("venue_id");
        }

        // Try body (clone request to avoid consuming it)
        if (!venueId) {
          try {
            const clonedReq = req.clone();
            const body = await clonedReq.json();
            venueId = body?.venueId || body?.venue_id || null;
          } catch (error) {
            // Body parsing failed or no body - this is expected for GET requests
            logger.debug("[UNIFIED AUTH] Body parsing failed (expected for some requests):", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Auth + venue access
      // VenueId is required for withUnifiedAuth - routes without venue should use basic auth
      if (!venueId) {
        logger.warn("[UNIFIED AUTH] venueId not found in request", {
          url: req.url,
          method: req.method,
          hasParams: !!routeParams?.params,
        });
        return NextResponse.json(
          { error: "Bad Request", message: "venueId is required" },
          { status: 400 }
        );
      }

      const authResult = await requireAuthAndVenueAccess(req, venueId);

      if (!authResult.success) {
        logger.warn("[UNIFIED AUTH] Authentication or venue access failed", {
          url: req.url,
          venueId,
          status: authResult.response.status,
        });
        return authResult.response;
      }

      const context = authResult.context;

      // Feature check
      if (options?.requireFeature) {
        const featureCheck = await enforceFeatureAccess(context.user.id, options.requireFeature);
        if (!featureCheck.allowed) {
          return featureCheck.response;
        }
      }

      // Role check
      if (options?.requireRole) {
        if (!hasRole(context, options.requireRole)) {
          return NextResponse.json(
            {
              error: "Forbidden",
              message: `This action requires one of these roles: ${options.requireRole.join(", ")}`,
              currentRole: context.role,
            },
            { status: 403 }
          );
        }
      }

      // Owner check
      if (options?.requireOwner) {
        if (!isOwner(context)) {
          return NextResponse.json(
            {
              error: "Forbidden",
              message: "This action requires owner role",
              currentRole: context.role,
            },
            { status: 403 }
          );
        }
      }

      // Call handler with authorized context and route params
      return await handler(req, context, routeParams);
    } catch (error) {
      logger.error("[UNIFIED AUTH] Error in route handler", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Internal Server Error", message: "Request processing failed" },
        { status: 500 }
      );
    }
  };
}

