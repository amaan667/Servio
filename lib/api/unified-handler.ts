/**
 * Unified API Handler
 * 
 * This is the SINGLE SOURCE OF TRUTH for all API route handlers.
 * It combines the best features from all previous handler implementations:
 * - Production-grade error handling and logging
 * - Unified authentication and authorization
 * - Rate limiting
 * - Idempotency support
 * - APM monitoring
 * - Performance tracking
 * - Request/response standardization
 * 
 * Migration: All routes should use this handler going forward.
 * Existing routes using withUnifiedAuth will continue to work, but new routes
 * should use createUnifiedHandler for consistency.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { 
  apiErrors, 
  success, 
  handleZodError, 
  ApiResponse 
} from "./standard-response";
import { 
  getAuthUserFromRequest, 
  verifyVenueAccess, 
  AuthContext,
  hasRole,
  isOwner
} from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS, type RateLimitConfig } from "@/lib/rate-limit";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";
import { performanceTracker } from "@/lib/monitoring/performance-tracker";
import { logger } from "@/lib/monitoring/structured-logger";
import { startTransaction } from "@/lib/monitoring/apm";
import { isDevelopment } from "@/lib/env";
import { keysToCamel, keysToSnake } from "@/lib/utils/casing";

export interface UnifiedHandlerOptions<TBody = unknown> {
  /** Zod schema for request body validation */
  schema?: ZodSchema<TBody>;
  /** Require authentication (default: true) */
  requireAuth?: boolean;
  /** Require venue access (implies requireAuth) */
  requireVenueAccess?: boolean;
  /** Require specific roles */
  requireRole?: string[];
  /** Require owner role */
  requireOwner?: boolean;
  /** Require specific feature access */
  requireFeature?: keyof import("@/lib/tier-restrictions").TierLimits["features"];
  /** Rate limit configuration */
  rateLimit?: RateLimitConfig;
  /** Enforce idempotency key */
  enforceIdempotency?: boolean;
  /** Source for venueId extraction */
  venueIdSource?: "params" | "query" | "body" | "header" | "auto";
  /** Custom venueId extractor */
  extractVenueId?: (
    req: NextRequest,
    routeParams?: { params?: Promise<Record<string, string>> | Record<string, string> }
  ) => Promise<string | null>;
  /** Auto-convert between snake_case and camelCase */
  autoCase?: boolean;
  /** Track performance metrics */
  trackPerformance?: boolean;
}

export type UnifiedHandlerFunction<TBody = unknown, TResponse = unknown> = (
  req: NextRequest,
  context: AuthContext & { body: TBody; params: Record<string, string> }
) => Promise<TResponse | NextResponse>;

/**
 * Create a unified API handler with all production features
 * 
 * This is the recommended handler for all new API routes.
 * It provides:
 * - Rate limiting
 * - Authentication & authorization
 * - Request validation
 * - Error handling
 * - Performance tracking
 * - APM monitoring
 * - Idempotency support
 */
export function createUnifiedHandler<TBody = unknown, TResponse = unknown>(
  handler: UnifiedHandlerFunction<TBody, TResponse>,
  options: UnifiedHandlerOptions<TBody> = {}
) {
  return async (
    req: NextRequest,
    routeContext?: { params?: Promise<Record<string, string>> | Record<string, string> }
  ): Promise<NextResponse<ApiResponse<TResponse>>> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const perf = performanceTracker.start(`api:${req.nextUrl.pathname}`);
    
    // Start APM transaction
    const apmTransaction = startTransaction(`api.${req.method.toLowerCase()}.${req.nextUrl.pathname}`, "web");
    apmTransaction.setTag("request.id", requestId);
    apmTransaction.setTag("http.method", req.method);
    apmTransaction.setTag("http.url", req.nextUrl.pathname);

    try {
      // 1. Rate Limiting (per-user when middleware set x-user-id, else per-IP)
      const rlConfig = options.rateLimit || RATE_LIMITS.GENERAL;
      const userId = req.headers.get("x-user-id");
      const configWithId = { ...rlConfig, identifier: userId || undefined };
      const rlResult = await rateLimit(req, configWithId);
      if (!rlResult.success) {
        perf.end();
        logger.warn("Rate limit exceeded", {
          requestId,
          path: req.nextUrl.pathname,
          method: req.method,
          type: "rate_limit",
        });
        return apiErrors.rateLimit(Math.ceil((rlResult.reset - Date.now()) / 1000), requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      // 2. Resolve Params
      let params: Record<string, string> = {};
      if (routeContext?.params) {
        params = routeContext.params instanceof Promise 
          ? await routeContext.params 
          : routeContext.params;
      }

      // 3. Authentication
      let user: { id: string; email?: string } | null = null;
      let authError: string | null = null;
      
      // eslint-disable-next-line no-console
      console.log("[UNIFIED-HANDLER] Auth check", {
        path: req.nextUrl.pathname,
        method: req.method,
        requireAuth: options.requireAuth !== false,
        headers: {
          userId: req.headers.get("x-user-id"),
          email: req.headers.get("x-user-email"),
          tier: req.headers.get("x-user-tier"),
          role: req.headers.get("x-user-role"),
          venueId: req.headers.get("x-venue-id"),
        },
      });
      
      if (options.requireAuth !== false) {
        try {
          const authResult = await getAuthUserFromRequest(req);
          user = authResult.user;
          authError = authResult.error;
          
          // eslint-disable-next-line no-console
          console.log("[UNIFIED-HANDLER] Auth result", {
            hasUser: !!user,
            userId: user?.id,
            error: authError,
          });
          
          if (!user || authError) {
            perf.end();
            // eslint-disable-next-line no-console
            console.error("[UNIFIED-HANDLER] Authentication failed", {
              requestId,
              path: req.nextUrl.pathname,
              method: req.method,
              error: authError,
              type: "authentication",
            });
            return apiErrors.unauthorized(authError || "Authentication required", requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
          }
        } catch (authErr) {
          perf.end();
          logger.warn("Authentication check failed", {
            requestId,
            path: req.nextUrl.pathname,
            method: req.method,
            error: authErr instanceof Error ? authErr.message : "Unknown error",
            type: "authentication",
          });
          return apiErrors.unauthorized("Authentication check failed", requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
        }
      }

      // 4. Extract Venue ID
      let venueId: string | null = null;
      
      if (options.extractVenueId) {
        venueId = await options.extractVenueId(req.clone() as NextRequest, routeContext);
      } else if (options.requireVenueAccess) {
        const source = options.venueIdSource || "auto";
        if (source === "params" || source === "auto") {
          venueId = params.venueId || params.venue_id || null;
        }
        if (!venueId && (source === "query" || source === "auto")) {
          const searchParams = req.nextUrl.searchParams;
          venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        }
      }

      // Normalize venueId - database and access_context always use "venue-" prefix
      if (venueId) {
        venueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      }

      // 5. Parse and Validate Body
      let body: TBody = {} as TBody;
      const contentType = req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        try {
          const rawBody = await req.json();
          body = options.autoCase ? keysToSnake(rawBody) : rawBody;
        } catch (e) {
          if (req.method !== "GET" && req.method !== "DELETE") {
            perf.end();
            return apiErrors.badRequest("Invalid JSON body", undefined, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
          }
        }
      }

      if (!venueId && options.requireVenueAccess && body && typeof body === "object") {
        const bodyObj = body as Record<string, unknown>;
        const bodyVenueId =
          (bodyObj.venueId as string | undefined) || (bodyObj.venue_id as string | undefined) || null;

        if (bodyVenueId) {
          venueId = bodyVenueId.startsWith("venue-") ? bodyVenueId : `venue-${bodyVenueId}`;
        }
      }

      // 6. Venue Access & Context
      let authContext: AuthContext;
      if (options.requireVenueAccess) {
        if (!venueId) {
          perf.end();
          return apiErrors.badRequest("venueId is required for this route", undefined, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        if (!user) {
          perf.end();
          return apiErrors.unauthorized("Authentication required", requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        // Check if tier/role headers are already set (from middleware for dashboard routes)
        // If not, we need to call RPC to get them (for API routes)
        let tier = req.headers.get("x-user-tier");
        let role = req.headers.get("x-user-role");
        const headerVenueId = req.headers.get("x-venue-id");

        // eslint-disable-next-line no-console
        console.log("[UNIFIED-HANDLER] Checking headers before venue access", {
          hasTier: !!tier,
          hasRole: !!role,
          hasVenueId: !!headerVenueId,
          venueId,
        });

        // If tier/role headers missing, call RPC (for API routes that middleware didn't process)
        if (!tier || !role || headerVenueId !== venueId) {
          // eslint-disable-next-line no-console
          console.log("[UNIFIED-HANDLER] Headers missing, calling RPC", {
            venueId,
            userId: user.id,
          });

          const { getAccessContext } = await import("@/lib/access/getAccessContext");
          const accessContext = await getAccessContext(venueId);
          
          if (!accessContext || accessContext.user_id !== user.id || accessContext.venue_id !== venueId) {
            perf.end();
            // eslint-disable-next-line no-console
            console.error("[UNIFIED-HANDLER] RPC returned invalid access context", {
              hasContext: !!accessContext,
              contextUserId: accessContext?.user_id,
              requestedUserId: user.id,
              contextVenueId: accessContext?.venue_id,
              requestedVenueId: venueId,
            });
            return apiErrors.forbidden("Access denied to this venue", undefined, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
          }

          tier = accessContext.tier;
          role = accessContext.role;

          // Set headers for downstream use
          req.headers.set("x-user-tier", tier);
          req.headers.set("x-user-role", role);
          req.headers.set("x-venue-id", venueId);
        }

        // Verify venue access (this will use headers we just set)
        // eslint-disable-next-line no-console
        console.log("[UNIFIED-HANDLER] Verifying venue access", {
          venueId,
          userId: user.id,
          tier,
          role,
        });

        const access = await verifyVenueAccess(venueId, user.id);
        
        // eslint-disable-next-line no-console
        console.log("[UNIFIED-HANDLER] Venue access result", {
          hasAccess: !!access,
          venueId,
          userId: user.id,
          tier: access?.tier,
          role: access?.role,
        });
        
        if (!access) {
          perf.end();
          // eslint-disable-next-line no-console
          console.error("[UNIFIED-HANDLER] Venue access denied", {
            requestId,
            path: req.nextUrl.pathname,
            userId: user.id,
            venueId,
          });
          return apiErrors.forbidden("Access denied to this venue", undefined, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        // Feature check
        if (options.requireFeature) {
          const { enforceFeatureAccess } = await import("@/lib/auth/unified-auth");
          const featureCheck = await enforceFeatureAccess(access.venue.owner_user_id, options.requireFeature);
          if (!featureCheck.allowed) {
            perf.end();
            return featureCheck.response as unknown as NextResponse<ApiResponse<TResponse>>;
          }
        }

        // Role check
        if (options.requireRole && !hasRole(access as AuthContext, options.requireRole)) {
          perf.end();
          return apiErrors.forbidden(
            `Requires one of: ${options.requireRole.join(", ")}`, 
            { currentRole: access.role }, 
            requestId
          ) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        // Owner check
        if (options.requireOwner && !isOwner(access as AuthContext)) {
          perf.end();
          return apiErrors.forbidden("This action requires owner role", { currentRole: access.role }, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        authContext = { ...access, venueId } as AuthContext;
      } else if (venueId && user) {
        // Optional venue access - try to get context if venueId provided
        const access = await verifyVenueAccess(venueId, user.id);
        if (access) {
          authContext = { ...access, venueId };
        } else {
          // No venue access, but that's OK for optional venue routes
          authContext = {
            user: { id: user.id, email: user.email },
            venue: {
              venue_id: "",
              owner_user_id: user.id,
              venue_name: "",
              name: "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            role: "none",
            venueId: "",
            tier: "starter",
            venue_ids: []
          };
        }
      } else {
        // No venue required
        authContext = {
          user: user ? { id: user.id, email: user.email } : ({} as { id: string; email: string }),
          venue: {
            venue_id: "",
            owner_user_id: user?.id || "",
            venue_name: "",
            name: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          role: "none",
          venueId: "",
          tier: "starter",
          venue_ids: []
        };
      }

      // 7. Zod Validation
      if (options.schema) {
        try {
          body = options.schema.parse(body);
        } catch (e) {
          perf.end();
          if (e instanceof ZodError) {
            return handleZodError(e) as unknown as NextResponse<ApiResponse<TResponse>>;
          }
          throw e;
        }
      }

      // 8. Idempotency
      const idempotencyKey = req.headers.get("x-idempotency-key");
      if (idempotencyKey) {
        const existing = await checkIdempotency(idempotencyKey);
        if (existing.exists) {
          perf.end();
          return success(existing.response.response_data as TResponse, {
            timestamp: new Date().toISOString(),
            requestId,
            duration: Date.now() - startTime
          });
        }
      } else if (options.enforceIdempotency) {
        perf.end();
        return apiErrors.badRequest("x-idempotency-key header is required", requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      // 9. Execute Handler
      const result = await handler(req, {
        ...authContext,
        body,
        params
      });

      // If handler returns NextResponse directly, use it
      if (result instanceof NextResponse) {
        perf.end();
        return result as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      const responseData = options.autoCase && result ? keysToCamel(result) : result;

      // 10. Store Idempotency
      if (idempotencyKey) {
        await storeIdempotency(idempotencyKey, "", responseData, 200);
      }

      const duration = Date.now() - startTime;
      perf.end();
      
      // Finish APM transaction
      apmTransaction.setTag("http.status_code", "200");
      apmTransaction.finish();
      
      // Log successful request
      logger.logResponse(
        req.method,
        req.nextUrl.pathname,
        200,
        {
          requestId,
          userId: authContext.user?.id,
          venueId: authContext.venueId,
          duration,
        },
        duration
      );

      return success(responseData, {
        timestamp: new Date().toISOString(),
        requestId,
        duration
      });

    } catch (error) {
      perf.end();
      const duration = Date.now() - startTime;
      const err = error as Error;
      
      // Record error in APM
      apmTransaction.setTag("http.status_code", "500");
      apmTransaction.setTag("error", "true");
      apmTransaction.addError(err);
      apmTransaction.finish();
      
      // Log error with full context
      logger.error(
        `API handler error: ${err.message}`,
        {
          requestId,
          path: req.nextUrl.pathname,
          method: req.method,
          duration,
          errorName: err.name,
          type: "api_error",
        },
        err
      );

      // Handle specific error types
      if (err.name === "UnauthorizedError") {
        return apiErrors.unauthorized(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      }
      if (err.name === "ForbiddenError") {
        return apiErrors.forbidden(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      }
      if (err.name === "NotFoundError") {
        return apiErrors.notFound(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      }
      if (err.name === "ValidationError") {
        return apiErrors.validation(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      // Always include error message for debugging (even in production for now)
      // eslint-disable-next-line no-console
      console.error("❌ [UnifiedHandler] Unhandled error:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
        path: req.nextUrl.pathname,
        requestId,
      });
      
      return apiErrors.internal(
        err.message || "Internal server error",
        isDevelopment() ? { message: err.message, stack: err.stack, name: err.name } : { message: err.message },
        requestId
      ) as unknown as NextResponse<ApiResponse<TResponse>>;
    }
  };
}

/**
 * Re-export for backward compatibility
 * @deprecated Use createUnifiedHandler instead
 */
export { createApiHandler } from "./production-handler";
