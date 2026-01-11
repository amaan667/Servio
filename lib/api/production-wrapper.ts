/**
 * Production-Ready API Route Wrapper
 * Provides authentication, rate limiting, and error handling for all routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthForAPI, requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export interface RouteConfig {
  requireAuth?: boolean;
  requireVenueAccess?: boolean;
  rateLimit?: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS];
  public?: boolean; // For public routes like health checks
}

/**
 * Wrap an API route handler with production-ready features
 */
export function withProductionFeatures<T = unknown>(

    context?: { userId: string; venueId?: string }
  ) => Promise<NextResponse<T>>,
  config: RouteConfig = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Skip auth/rate limiting for public routes
      if (config.public) {
        return await handler(req);
      }

      // Apply rate limiting
      if (config.rateLimit) {
        const rateLimitResult = await rateLimit(req, config.rateLimit);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            {

              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
            },
            {

                "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
                "X-RateLimit-Reset": rateLimitResult.reset.toString(),
                "Retry-After": Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
              },
            }
          );
        }
      }

      // Apply authentication
      let userId: string | undefined;
      let venueId: string | undefined;

      if (config.requireAuth || config.requireVenueAccess) {
        const authResult = await requireAuthForAPI();
        if (authResult.error || !authResult.user) {
          return NextResponse.json(
            { error: "Unauthorized", message: authResult.error || "Authentication required" },
            { status: 401 }
          );
        }
        userId = authResult.user.id;
      }

      // Apply venue access check
      if (config.requireVenueAccess) {
        // Extract venueId from query params or body
        const url = new URL(req.url);
        let venueIdParam = url.searchParams.get("venueId") || url.searchParams.get("venue_id");

        // Try to get from body if not in query
        if (!venueIdParam) {
          try {
            const body = await req.clone().json();
            venueIdParam = body?.venueId || body?.venue_id;
          } catch {
            // Body parsing failed, continue without it
          }
        }

        if (!venueIdParam) {
          return NextResponse.json(
            { error: "Bad Request", message: "venueId is required" },
            { status: 400 }
          );
        }

        const venueAccessResult = await requireVenueAccessForAPI(venueIdParam);
        if (!venueAccessResult.success) {
          return venueAccessResult.response;
        }

        venueId = venueAccessResult.context.venueId;
      }

      // Call the handler with context
      return await handler(req, userId ? { userId, venueId } : undefined);
    } catch (error) {

      return NextResponse.json(
        { error: "Internal server error", message: "An unexpected error occurred" },
        { status: 500 }
      );
    }
  };
}
