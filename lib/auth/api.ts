/**
 * Standardized Authentication Utilities for API Routes
 * 
 * This module provides consistent authentication patterns for all API routes.
 * Use these utilities instead of manually checking auth in each route.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { verifyVenueAccess, type AuthorizedContext } from "@/lib/middleware/authorization";
import { logger } from "@/lib/logger";
import { trackAuthError } from "@/lib/monitoring/error-tracking";

import type { User } from "@supabase/supabase-js";

/**
 * Result type for authentication checks
 */
export interface AuthResult {
  user: User | null;
  error: string | null;
}

/**
 * Standardized authentication check for API routes
 * Returns user and error, does not throw
 */
export async function requireAuthForAPI(): Promise<AuthResult> {
  try {
    const { user, error } = await getAuthenticatedUser();

    if (error) {
      logger.warn("[AUTH API] Authentication failed", { error });
      trackAuthError(new Error(error), { action: "require_auth_api" });
      return { user: null, error };
    }

    if (!user) {
      logger.warn("[AUTH API] No user session found");
      trackAuthError(new Error("No user session"), { action: "require_auth_api" });
      return { user: null, error: "Not authenticated" };
    }

    return { user, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Authentication failed";
    logger.error("[AUTH API] Unexpected authentication error", { error: errorMessage });
    trackAuthError(err, { action: "require_auth_api" });
    return { user: null, error: errorMessage };
  }
}

/**
 * Standardized authentication + venue access check for API routes
 * Returns authorized context or error response
 */
export async function requireVenueAccessForAPI(
  venueId: string | null | undefined
): Promise<
  | { success: true; context: AuthorizedContext }
  | { success: false; response: NextResponse }
> {
  // Check authentication first
  const authResult = await requireAuthForAPI();

  if (authResult.error || !authResult.user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      ),
    };
  }

  // Check venue ID
  if (!venueId) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Bad Request", message: "venueId is required" },
        { status: 400 }
      ),
    };
  }

  // Verify venue access
  const access = await verifyVenueAccess(venueId, authResult.user.id);

  if (!access) {
    logger.warn("[AUTH API] Venue access denied", {
      userId: authResult.user.id,
      venueId,
    });
    trackAuthError(new Error("Venue access denied"), {
      userId: authResult.user.id,
      venueId,
      action: "require_venue_access_api",
    });
    return {
      success: false,
      response: NextResponse.json(
        { error: "Forbidden", message: "Access denied to this venue" },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    context: {
      venue: access.venue,
      user: access.user,
      role: access.role,
      venueId,
    },
  };
}

/**
 * Helper to extract venueId from request (query params or body)
 */
export function extractVenueId(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const venueIdFromQuery = url.searchParams.get("venueId");

    if (venueIdFromQuery) {
      return venueIdFromQuery;
    }

    // Try to parse body (non-destructive - doesn't consume the stream)
    // Note: This is a best-effort approach. For POST requests, you should
    // parse the body in your route handler and pass venueId explicitly.
    return null;
  } catch {
    return null;
  }
}

