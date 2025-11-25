/**
 * Authentication Middleware for API Routes
 * Provides consistent authentication and rate limiting for all routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthForAPI, requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  requireVenueAccess?: boolean;
  rateLimitConfig?: typeof RATE_LIMITS[keyof typeof RATE_LIMITS];
  public?: boolean;
}

/**
 * Apply authentication and rate limiting to a route handler
 */
export async function applyAuthMiddleware(
  req: NextRequest,
  options: AuthMiddlewareOptions = {}
): Promise<NextResponse | null> {
  // Skip for public routes
  if (options.public) {
    return null;
  }

  // Apply rate limiting
  if (options.rateLimitConfig) {
    const rateLimitResult = await rateLimit(req, options.rateLimitConfig);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": rateLimitResult.reset.toString(),
            "Retry-After": Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
  }

  // Apply authentication
  if (options.requireAuth || options.requireVenueAccess) {
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      );
    }
  }

  // Apply venue access check
  if (options.requireVenueAccess) {
    const url = new URL(req.url);
    let venueId = url.searchParams.get("venueId") || url.searchParams.get("venue_id");

    // Try to get from body if not in query
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed, continue
      }
    }

    if (!venueId) {
      return NextResponse.json(
        { error: "Bad Request", message: "venueId is required" },
        { status: 400 }
      );
    }

    const venueAccessResult = await requireVenueAccessForAPI(venueId);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }
  }

  return null; // Continue to handler
}

