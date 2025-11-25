/**
 * UNIFIED AUTHENTICATION, AUTHORIZATION, AND TIER SYSTEM
 * 
 * This is the SINGLE SOURCE OF TRUTH for all auth/role/tier checks.
 * 
 * Architecture (NO DUPLICATE CHECKS):
 * 1. Middleware (middleware.ts): 
 *    - SINGLE SOURCE OF TRUTH for authentication
 *    - Checks session with getSession()
 *    - Sets x-user-id and x-user-email headers if authenticated
 *    - NO duplicate checks in routes
 * 
 * 2. getAuthUserFromRequest():
 *    - Just reads x-user-id header (middleware already verified auth)
 *    - NO cookie reading, NO session checking, NO duplicate auth
 *    - Trusts middleware completely
 * 
 * 3. verifyVenueAccess():
 *    - Authorization check (venue access) - NOT duplicate auth
 *    - Checks if user can access venue (owner/staff)
 * 
 * 4. withUnifiedAuth wrapper:
 *    - Uses getAuthUserFromRequest (trusts middleware)
 *    - Checks venue access (authorization)
 *    - Checks tier/role if needed
 *    - NO duplicate authentication
 * 
 * 5. Pages/Components:
 *    - NEVER do auth checks - middleware already did it
 *    - Just render based on props
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
  // SINGLE SOURCE OF TRUTH: Trust middleware header (middleware already verified auth)
  // Middleware checks session and sets x-user-id header - no duplicate checks needed
  const middlewareUserId = request.headers.get("x-user-id");
  const middlewareEmail = request.headers.get("x-user-email");
  
  console.log("[AUTH] getAuthUserFromRequest:", {
    url: request.url,
    method: request.method,
    hasXUserIdHeader: !!middlewareUserId,
    xUserIdValue: middlewareUserId?.substring(0, 8) + "...",
    hasXUserEmailHeader: !!middlewareEmail,
    allHeaders: Array.from(request.headers.entries())
      .filter(([key]) => key.startsWith("x-"))
      .map(([key, value]) => [key, value?.substring(0, 20) + "..."]),
  });
  
  if (middlewareUserId) {
    // Middleware already verified auth - just trust the header
    // No need to re-check cookies or session - that's duplicate work
    console.log("[AUTH] ✅ Using middleware header (auth already verified)");
    return {
      user: {
        id: middlewareUserId,
        email: middlewareEmail || undefined,
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User,
      error: null,
    };
  }

  // No middleware header = not authenticated (middleware handles all auth checks)
  console.log("[AUTH] ❌ No middleware header found - not authenticated");
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
      console.log("[WITH_UNIFIED_AUTH] Route called:", {
        url: req.url,
        method: req.method,
        hasRouteParams: !!routeParams,
        hasXUserIdHeader: !!req.headers.get("x-user-id"),
      });
      
      // Extract venueId from params, query, or body
      let venueId: string | null = null;
      let parsedBody: unknown = null;
      let bodyConsumed = false;

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

        // Try body - read it ONCE and parse it
        // This is the permanent solution: read body once, parse once, use everywhere
        if (!venueId && req.method !== "GET") {
          const contentType = req.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              // Read body once and parse it
              parsedBody = await req.json();
              bodyConsumed = true;
              
              // Extract venueId from parsed body
              if (parsedBody && typeof parsedBody === "object" && parsedBody !== null) {
                venueId = (parsedBody as Record<string, unknown>)?.venueId as string || 
                         (parsedBody as Record<string, unknown>)?.venue_id as string || 
                         null;
                if (venueId) {
                  logger.debug("[UNIFIED AUTH] Extracted venueId from body", { venueId });
                }
              }
            } catch (parseError) {
              // Body parsing failed - log but continue
              logger.debug("[UNIFIED AUTH] Body parsing failed:", {
                method: req.method,
                error: parseError instanceof Error ? parseError.message : String(parseError),
              });
              parsedBody = null;
            }
          }
        }
      }

      // Auth + venue access
      // VenueId is required for withUnifiedAuth - routes without venue should use basic auth
      console.log("[WITH_UNIFIED_AUTH] VenueId extraction:", {
        venueId,
        method: req.method,
        url: req.url,
      });
      
      if (!venueId) {
        console.log("[WITH_UNIFIED_AUTH] ❌ venueId not found");
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

      console.log("[WITH_UNIFIED_AUTH] Calling requireAuthAndVenueAccess:", {
        venueId,
        hasXUserIdHeader: !!req.headers.get("x-user-id"),
      });
      
      const authResult = await requireAuthAndVenueAccess(req, venueId);

      if (!authResult.success) {
        console.log("[WITH_UNIFIED_AUTH] ❌ Auth failed:", {
          status: authResult.response.status,
          venueId,
        });
        logger.warn("[UNIFIED AUTH] Authentication or venue access failed", {
          url: req.url,
          venueId,
          status: authResult.response.status,
        });
        return authResult.response;
      }
      
      console.log("[WITH_UNIFIED_AUTH] ✅ Auth successful:", {
        userId: authResult.context.user.id.substring(0, 8) + "...",
        venueId: authResult.context.venueId,
        role: authResult.context.role,
      });

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

      // Reconstruct request with body if it was consumed
      // This ensures handlers can still call req.json() normally
      let requestToUse = req;
      if (bodyConsumed && parsedBody !== null) {
        // Create a new request with the parsed body re-stringified as a ReadableStream
        // This allows handlers to read the body normally via req.json()
        const bodyString = JSON.stringify(parsedBody);
        const bodyBytes = new TextEncoder().encode(bodyString);
        const bodyStream = new ReadableStream({
          start(controller) {
            controller.enqueue(bodyBytes);
            controller.close();
          },
        });
        
        // Create headers with correct Content-Length
        const headers = new Headers(req.headers);
        headers.set("Content-Length", bodyBytes.length.toString());
        headers.set("Content-Type", "application/json");
        
        requestToUse = new NextRequest(req.url, {
          method: req.method,
          headers,
          body: bodyStream,
        }) as NextRequest;
        
        // Preserve cookies from original request
        req.cookies.getAll().forEach((cookie) => {
          requestToUse.cookies.set(cookie.name, cookie.value);
        });
      }

      // Call handler with authorized context and route params
      // The request body is available for the handler to read normally
      return await handler(requestToUse, context, routeParams);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error("[UNIFIED AUTH] Error in route handler", {
        error: errorMessage,
        stack: errorStack,
        url: req.url,
        method: req.method,
      });
      
      // Return detailed error in development, generic in production
      return NextResponse.json(
        { 
          error: "Internal Server Error", 
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  };
}

