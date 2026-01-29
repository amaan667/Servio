/**
 * Production-Grade API Handler
 *
 * Standardized handler for all API routes in Servio.
 *
 * @deprecated Use createUnifiedHandler from './unified-handler' instead.
 * This handler is kept for backward compatibility but will be removed in a future version.
 * The unified handler includes all features from this handler plus additional improvements.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";
import { apiErrors, success, handleZodError, ApiResponse } from "./standard-response";
import {
  getAuthUserFromRequest,
  verifyVenueAccess,
  AuthContext,
  enforceFeatureAccess,
} from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS, type RateLimitConfig } from "@/lib/rate-limit";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";
import { performanceTracker } from "@/lib/monitoring/performance-tracker";
import { logger } from "@/lib/monitoring/structured-logger";
import { startTransaction } from "@/lib/monitoring/apm";
import { isDevelopment } from "@/lib/env";
import { keysToCamel, keysToSnake } from "@/lib/utils/casing";

export interface HandlerOptions<TBody = unknown> {
  schema?: ZodSchema<TBody>;
  requireAuth?: boolean;
  requireVenueAccess?: boolean;
  requireRole?: string[];
  requireFeature?: keyof import("@/lib/tier-restrictions").TierLimits["features"];
  rateLimit?: RateLimitConfig;
  enforceIdempotency?: boolean;
  venueIdSource?: "params" | "query" | "body" | "header" | "auto";
  autoCase?: boolean;
}

export type HandlerFunction<TBody = unknown, TResponse = unknown> = (
  req: NextRequest,
  context: AuthContext & { body: TBody; params: Record<string, string> }
) => Promise<TResponse>;

export function createApiHandler<TBody = unknown, TResponse = unknown>(
  handler: HandlerFunction<TBody, TResponse>,
  options: HandlerOptions<TBody> = {}
) {
  return async (
    req: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> | Record<string, string> }
  ): Promise<NextResponse<ApiResponse<TResponse>>> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    const perf = performanceTracker.start(`api:${req.nextUrl.pathname}`);

    // Start APM transaction (always returns valid object, even if APM not configured)
    const apmTransaction = startTransaction(
      `api.${req.method.toLowerCase()}.${req.nextUrl.pathname}`,
      "web"
    );
    apmTransaction.setTag("request.id", requestId);
    apmTransaction.setTag("http.method", req.method);
    apmTransaction.setTag("http.url", req.nextUrl.pathname);

    try {
      // 1. Rate Limiting
      const rlConfig = options.rateLimit || RATE_LIMITS.GENERAL;
      const rlResult = await rateLimit(req, rlConfig);
      if (!rlResult.success) {
        perf.end();
        logger.warn("Rate limit exceeded", {
          requestId,
          path: req.nextUrl.pathname,
          method: req.method,
          type: "rate_limit",
        });
        return apiErrors.rateLimit(
          Math.ceil((rlResult.reset - Date.now()) / 1000),
          requestId
        ) as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      // 2. Resolve Params
      let params: Record<string, string> = {};
      if (routeContext?.params) {
        params =
          routeContext.params instanceof Promise ? await routeContext.params : routeContext.params;
      }

      // 3. Authentication
      // Skip auth check entirely for public endpoints to avoid cookie issues in private browsers
      let user: { id: string; email?: string } | null = null;
      let authError: string | null = null;

      if (options.requireAuth !== false) {
        try {
          const authResult = await getAuthUserFromRequest(req);
          user = authResult.user;
          authError = authResult.error;

          if (!user || authError) {
            perf.end();
            logger.warn("Authentication failed", {
              requestId,
              path: req.nextUrl.pathname,
              method: req.method,
              error: authError,
              type: "authentication",
            });
            return apiErrors.unauthorized(
              authError || "Authentication required",
              requestId
            ) as unknown as NextResponse<ApiResponse<TResponse>>;
          }
        } catch (authErr) {
          // If getAuthUserFromRequest throws (e.g., in private browsers), treat as no auth
          perf.end();
          logger.warn("Authentication check failed", {
            requestId,
            path: req.nextUrl.pathname,
            method: req.method,
            error: authErr instanceof Error ? authErr.message : "Unknown error",
            type: "authentication",
          });
          return apiErrors.unauthorized(
            "Authentication check failed",
            requestId
          ) as unknown as NextResponse<ApiResponse<TResponse>>;
        }
      }
      // For public endpoints (requireAuth: false), user remains null - no auth check needed

      // 4. Extract Venue ID
      let venueId: string | null = null;
      if (options.requireVenueAccess) {
        const source = options.venueIdSource || "auto";
        if (source === "params" || (source as string) === "auto")
          venueId = params.venueId || params.venue_id || null;
        if (!venueId && (source === "query" || (source as string) === "auto")) {
          const searchParams = req.nextUrl.searchParams;
          venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        }
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
            return apiErrors.badRequest(
              "Invalid JSON body",
              undefined,
              requestId
            ) as unknown as NextResponse<ApiResponse<TResponse>>;
          }
        }
      }

      if (!venueId && options.requireVenueAccess && body && typeof body === "object") {
        const bodyObj = body as Record<string, unknown>;
        venueId = (bodyObj.venueId as string) || (bodyObj.venue_id as string) || null;
      }

      // 6. Venue Access & Context
      let authContext: AuthContext;
      if (options.requireVenueAccess) {
        if (!venueId) {
          perf.end();
          return apiErrors.badRequest(
            "venueId is required for this route",
            undefined,
            requestId
          ) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        const access = await verifyVenueAccess(venueId, user!.id);
        if (!access) {
          perf.end();
          return apiErrors.forbidden(
            "Access denied to this venue",
            undefined,
            requestId
          ) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        if (options.requireFeature) {
          const featureCheck = await enforceFeatureAccess(
            access.venue.owner_user_id,
            options.requireFeature
          );
          if (!featureCheck.allowed) {
            perf.end();
            return featureCheck.response as unknown as NextResponse<ApiResponse<TResponse>>;
          }
        }

        if (options.requireRole && !options.requireRole.includes(access.role)) {
          perf.end();
          return apiErrors.forbidden(
            `Requires one of: ${options.requireRole.join(", ")}`,
            { currentRole: access.role },
            requestId
          ) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        authContext = { ...access, venueId };
      } else {
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
          venue_ids: [],
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
            duration: Date.now() - startTime,
          });
        }
      } else if (options.enforceIdempotency) {
        perf.end();
        return apiErrors.badRequest(
          "x-idempotency-key header is required",
          requestId
        ) as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      // 9. Execute Handler
      const result = await handler(req, {
        ...authContext,
        body,
        params,
      });

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

      // Finish APM transaction (no-op if APM not configured)
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
        duration,
      });
    } catch (error) {
      perf.end();
      const duration = Date.now() - startTime;
      const err = error as Error;

      // Record error in APM (no-op if APM not configured)
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

      if (err.name === "UnauthorizedError")
        return apiErrors.unauthorized(err.message, requestId) as unknown as NextResponse<
          ApiResponse<TResponse>
        >;
      if (err.name === "ForbiddenError")
        return apiErrors.forbidden(err.message, requestId) as unknown as NextResponse<
          ApiResponse<TResponse>
        >;
      if (err.name === "NotFoundError")
        return apiErrors.notFound(err.message, requestId) as unknown as NextResponse<
          ApiResponse<TResponse>
        >;
      if (err.name === "ValidationError")
        return apiErrors.validation(err.message, requestId) as unknown as NextResponse<
          ApiResponse<TResponse>
        >;

      return apiErrors.internal(
        "Internal server error",
        isDevelopment() ? { message: err.message, stack: err.stack } : undefined,
        requestId
      ) as unknown as NextResponse<ApiResponse<TResponse>>;
    }
  };
}
