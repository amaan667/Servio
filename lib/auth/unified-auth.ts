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
import { verifyVenueAccess, type AuthorizedContext } from "@/lib/middleware/authorization";
import { checkFeatureAccess, checkLimit, getUserTier, TIER_LIMITS } from "@/lib/tier-restrictions";
import { logger } from "@/lib/logger";
import { apiErrors } from "@/lib/api/standard-response";
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
  // Middleware already verified auth - just read the header
  const middlewareUserId = request.headers.get("x-user-id");
  const middlewareEmail = request.headers.get("x-user-email");
  
  if (middlewareUserId) {
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

  // Fallback: Read session from cookies if middleware didn't process this route
  // This is needed for routes like /api/stripe that aren't in protectedPaths
  try {
    const { createServerClient } = await import("@supabase/ssr");
    const supabaseModule = await import("@/lib/supabase");
    
    // Create Supabase client with request cookies (similar to middleware)
    const supabase = createServerClient(
      supabaseModule.getSupabaseUrl(),
      supabaseModule.getSupabaseAnonKey(),
      {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {
          // Read-only mode - we're just reading the session
        },
        remove() {
          // Read-only mode
        },
      },
    });
    
    // Use getUser() instead of getSession() for secure authentication
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      // Silently handle refresh token errors
      if (
        error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Invalid Refresh Token")
      ) {
        return { user: null, error: null };
      }
      return { user: null, error: error.message };
    }

    if (user) {
      return { user, error: null };
    }

    return { user: null, error: "No authentication found" };
  } catch (error) {
    // If cookie reading fails, return no auth
    logger.debug("[UNIFIED AUTH] Fallback cookie read failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { user: null, error: "No authentication found" };
  }
}

/**
 * Simple auth check (no venue required)
 * For system routes that don't need venue access
 */
export async function requireAuth(
  request: NextRequest
): Promise<
  | { success: true; user: User }
  | { success: false; response: NextResponse }
> {
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

  return { success: true, user };
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
    // Log auth wrapper entry (only in development)
    if (process.env.NODE_ENV === "development") {
      logger.debug("[UNIFIED AUTH] Wrapper entry", {
        url: req.url,
        method: req.method,
      });
    }
    
    try {
      // Extract venueId from params, query, or body
       
      logger.debug("[UNIFIED AUTH] Step 1: Extracting venueId...");
      let venueId: string | null = null;
      let parsedBody: unknown = null;
      let bodyConsumed = false;

      // Track if we used custom extractor (to know if null is intentional)
      const usedCustomExtractor = !!options?.extractVenueId;
      
      // Use custom extractor if provided
      if (options?.extractVenueId) {
         
        logger.debug("[UNIFIED AUTH] Using custom venueId extractor");
        venueId = await options.extractVenueId(req, routeParams);
         
        logger.debug("[UNIFIED AUTH] Custom extractor returned:", venueId);
      } else {
        // Try params first (await if it's a Promise)
        if (routeParams?.params) {
           
          logger.debug("[UNIFIED AUTH] Trying venueId from route params...");
          const params = await routeParams.params;
          venueId = params?.venueId || null;
           
          logger.debug("[UNIFIED AUTH] Params venueId:", venueId);
        }

        // Try query string
        if (!venueId) {
           
          logger.debug("[UNIFIED AUTH] Trying venueId from query string...");
          const url = new URL(req.url);
          venueId = url.searchParams.get("venueId") || url.searchParams.get("venue_id");
           
          logger.debug("[UNIFIED AUTH] Query venueId:", venueId);
        }

        // Try body - read it ONCE and parse it
        // This is the permanent solution: read body once, parse once, use everywhere
        if (!venueId && req.method !== "GET") {
           
          logger.debug("[UNIFIED AUTH] Trying venueId from request body...");
          const contentType = req.headers.get("content-type");
           
          logger.debug("[UNIFIED AUTH] Content-Type:", contentType);
          if (contentType && contentType.includes("application/json")) {
            try {
              // Read body once and parse it
              parsedBody = await req.json();
              bodyConsumed = true;
               
              logger.debug("[UNIFIED AUTH] Body parsed successfully");
              
              // Extract venueId from parsed body
              if (parsedBody && typeof parsedBody === "object" && parsedBody !== null) {
                const bodyObj = parsedBody as Record<string, unknown>;
                venueId = (bodyObj.venueId as string) || 
                         (bodyObj.venue_id as string) || 
                         null;
                if (venueId) {
                   
                  logger.debug("[UNIFIED AUTH] Extracted venueId from body:", venueId);
                  logger.debug("[UNIFIED AUTH] Extracted venueId from body", { venueId });
                } else {
                   
                  logger.debug("[UNIFIED AUTH] No venueId found in body, body keys:", Object.keys(bodyObj));
                }
              } else {
                 
                logger.debug("[UNIFIED AUTH] Body is not an object:", typeof parsedBody);
              }
            } catch (parseError) {
              // Body parsing failed - log but continue
              logger.warn("[UNIFIED AUTH] Body parsing failed:", {
                method: req.method,
                error: parseError instanceof Error ? parseError.message : String(parseError),
                stack: parseError instanceof Error ? parseError.stack : undefined,
              });
              logger.debug("[UNIFIED AUTH] Body parsing failed:", {
                method: req.method,
                error: parseError instanceof Error ? parseError.message : String(parseError),
              });
              parsedBody = null;
            }
          } else {
             
            logger.debug("[UNIFIED AUTH] Content-Type not JSON, skipping body parse");
          }
        }
      }

      logger.debug("[UNIFIED AUTH] Final venueId:", venueId, "usedCustomExtractor:", usedCustomExtractor);

      // If custom extractor returned null, this route doesn't need venueId - skip venue check
      if (!venueId && usedCustomExtractor) {
         
        logger.debug("[UNIFIED AUTH] Custom extractor returned null - skipping venue check (system route)");
        
        // Just check auth, no venue access needed
        const authResult = await requireAuth(req);
        if (!authResult.success) {
          return authResult.response;
        }

        // Call handler without venue context (system route)
        // Create minimal context for system routes
        const systemContext: AuthContext = {
          user: {
            id: authResult.user.id,
            email: authResult.user.email,
          } as AuthorizedContext["user"],
          venue: {
            venue_id: "",
            owner_user_id: authResult.user.id,
            name: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as AuthorizedContext["venue"],
          venueId: "",
          role: "owner",
          tier: "starter", // Default tier for system routes
        };
        return await handler(req, systemContext, routeParams);
      }

      // Auth + venue access (venueId is required)
      if (!venueId) {
         
        logger.error("[UNIFIED AUTH] venueId is required but not found");
        return NextResponse.json(
          { error: "Bad Request", message: "venueId is required" },
          { status: 400 }
        );
      }

      logger.debug("[UNIFIED AUTH] Step 2: Checking authentication and venue access...");
      const authResult = await requireAuthAndVenueAccess(req, venueId);

      if (!authResult.success) {
         
        logger.error("[UNIFIED AUTH] Auth/venue access check failed");
        return authResult.response;
      }

      // Auth successful
      logger.debug({
        userId: authResult.context.user.id,
        venueId: authResult.context.venueId,
        role: authResult.context.role,
        tier: authResult.context.tier,
      });
      const context = authResult.context;

      // Feature check
      if (options?.requireFeature) {
         
        logger.debug("[UNIFIED AUTH] Step 3: Checking feature access:", options.requireFeature);
        const featureCheck = await enforceFeatureAccess(context.user.id, options.requireFeature);
        if (!featureCheck.allowed) {
           
          logger.error("[UNIFIED AUTH] Feature access denied:", { feature: options.requireFeature });
          return featureCheck.response;
        }
         
        logger.debug("[UNIFIED AUTH] Step 3a: Feature access granted");
      }

      // Role check
      if (options?.requireRole) {
         
        logger.debug("[UNIFIED AUTH] Step 4: Checking role:", options.requireRole);
        if (!hasRole(context, options.requireRole)) {
           
          logger.error("[UNIFIED AUTH] Role check failed", {
            required: options.requireRole,
            current: context.role,
          });
          return NextResponse.json(
            {
              error: "Forbidden",
              message: `This action requires one of these roles: ${options.requireRole.join(", ")}`,
              currentRole: context.role,
            },
            { status: 403 }
          );
        }
         
        logger.debug("[UNIFIED AUTH] Step 4a: Role check passed");
      }

      // Owner check
      if (options?.requireOwner) {
         
        logger.debug("[UNIFIED AUTH] Step 5: Checking owner role");
        if (!isOwner(context)) {
           
          logger.error("[UNIFIED AUTH] Owner check failed", { currentRole: context.role });
          return NextResponse.json(
            {
              error: "Forbidden",
              message: "This action requires owner role",
              currentRole: context.role,
            },
            { status: 403 }
          );
        }
         
        logger.debug("[UNIFIED AUTH] Step 5a: Owner check passed");
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
        
        // Node.js 18+ requires 'duplex: half' when creating Request with ReadableStream body
        requestToUse = new NextRequest(req.url, {
          method: req.method,
          headers,
          body: bodyStream,
          // @ts-expect-error - duplex is required for ReadableStream body in Node.js 18+
          duplex: "half",
        }) as NextRequest;
        
        // Preserve cookies from original request
        req.cookies.getAll().forEach((cookie) => {
          requestToUse.cookies.set(cookie.name, cookie.value);
        });
      }

      // Call handler with authorized context and route params
      // The request body is available for the handler to read normally
       
      logger.debug("[UNIFIED AUTH] Step 6: Calling route handler...");
       
      logger.debug("=".repeat(80));
      const response = await handler(requestToUse, context, routeParams);
      // Handler completed successfully
      logger.debug({
        status: response.status,
        statusText: response.statusText,
      });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error("[UNIFIED AUTH] Error in wrapper", {
        timestamp: new Date().toISOString(),
        error: errorMessage,
        stack: errorStack,
        url: req.url,
        method: req.method,
      });
      
      // Use standard error response format
      return apiErrors.internal(
        "Request processing failed",
        process.env.NODE_ENV === "development" ? { message: errorMessage, stack: errorStack } : undefined
      );
    }
  };
}

