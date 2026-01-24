/**
 * Production-Grade API Handler
 * 
 * Standardized handler for all API routes in Servio.
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
  enforceFeatureAccess
} from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS, type RateLimitConfig } from "@/lib/rate-limit";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";
import { performanceTracker } from "@/lib/monitoring/performance-tracker";
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

    try {
      // 1. Rate Limiting
      const rlConfig = options.rateLimit || RATE_LIMITS.GENERAL;
      const rlResult = await rateLimit(req, rlConfig);
      if (!rlResult.success) {
        perf.end();
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
      const { user, error: authError } = await getAuthUserFromRequest(req);
      if (options.requireAuth !== false && (!user || authError)) {
        perf.end();
        return apiErrors.unauthorized(authError || "Authentication required", requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      // 4. Extract Venue ID
      let venueId: string | null = null;
      if (options.requireVenueAccess) {
        const source = options.venueIdSource || "auto";
        if (source === "params" || (source as string) === "auto") venueId = params.venueId || params.venue_id || null;
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
            return apiErrors.badRequest("Invalid JSON body", undefined, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
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
          return apiErrors.badRequest("venueId is required for this route", undefined, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        const access = await verifyVenueAccess(venueId, user!.id);
        if (!access) {
          perf.end();
          return apiErrors.forbidden("Access denied to this venue", undefined, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
        }

        if (options.requireFeature) {
          const featureCheck = await enforceFeatureAccess(access.venue.owner_user_id, options.requireFeature);
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

      if (result instanceof NextResponse) {
        perf.end();
        return result as unknown as NextResponse<ApiResponse<TResponse>>;
      }

      const responseData = options.autoCase && result ? keysToCamel(result) : result;

      // 10. Store Idempotency
      if (idempotencyKey) {
        await storeIdempotency(idempotencyKey, "", responseData, 200);
      }

      perf.end();
      return success(responseData, {
        timestamp: new Date().toISOString(),
        requestId,
        duration: Date.now() - startTime
      });

    } catch (error) {
      perf.end();
      const err = error as Error;
      if (err.name === "UnauthorizedError") return apiErrors.unauthorized(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      if (err.name === "ForbiddenError") return apiErrors.forbidden(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      if (err.name === "NotFoundError") return apiErrors.notFound(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;
      if (err.name === "ValidationError") return apiErrors.validation(err.message, requestId) as unknown as NextResponse<ApiResponse<TResponse>>;

      return apiErrors.internal(
        "Internal server error",
        isDevelopment() ? { message: err.message, stack: err.stack } : undefined,
        requestId
      ) as unknown as NextResponse<ApiResponse<TResponse>>;
    }
  };
}
