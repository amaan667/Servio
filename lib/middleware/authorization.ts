/**
 * Centralized Authorization Middleware
 * Eliminates 32+ duplicate venue ownership checks across the codebase
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { getAuthenticatedUser as getAuthUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export interface Venue {
  venue_id: string;
  owner_user_id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email?: string;
  [key: string]: unknown;
}

export interface VenueAccess {
  venue: Venue;
  user: User;
  role: string;
}

export interface AuthorizedContext {
  venue: Venue;
  user: User;
  role: string;
  venueId: string;
}

/**
 * Verify user has access to venue (owner or staff)
 */
export async function verifyVenueAccess(
  venueId: string,
  userId: string
): Promise<VenueAccess | null> {
  try {
    const supabase = await createSupabaseClient();

    // First check if user has a role in user_venue_roles
    const { data: roleData, error: roleError } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleError && roleData?.role) {
      // User has a role, get venue details
      const { data: venue, error: venueFetchError } = await supabase
        .from("venues")
        .select("*")
        .eq("venue_id", venueId)
        .single();

      if (venue && !venueFetchError) {
        return {
          venue,
          user: { id: userId },
          role: roleData.role,
        };
      }
    }

    // Fallback: Check if user owns the venue
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (venueError || !venue) {
      logger.warn("Venue access denied", { venueId, userId, error: venueError?.message });
      return null;
    }

    return {
      venue,
      user: { id: userId },
      role: "owner",
    };
  } catch (_error) {
    logger.error("Error verifying venue access", { venueId, userId, error: _error });
    return null;
  }
}

/**
 * Verify venue exists and is valid (for public routes)
 * This is a lightweight check that doesn't require user authentication
 * but ensures the venue exists and is accessible
 */
export async function verifyVenueExists(
  venueId: string
): Promise<{ valid: boolean; venue?: Venue; error?: string }> {
  try {
    const supabase = await createSupabaseClient();

    // Use authenticated client which respects RLS
    // For public routes, this will still work if RLS allows public read access
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id, owner_user_id, name, created_at, updated_at")
      .eq("venue_id", venueId)
      .maybeSingle();

    if (venueError) {
      logger.warn("[VENUE VERIFY] Venue lookup error", { venueId, error: venueError.message });
      return { valid: false, error: venueError.message };
    }

    if (!venue) {
      logger.warn("[VENUE VERIFY] Venue not found", { venueId });
      return { valid: false, error: "Venue not found" };
    }

    return { valid: true, venue };
  } catch (error) {
    logger.error("[VENUE VERIFY] Error verifying venue", { venueId, error });
    return { valid: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Verify order belongs to venue (for public routes)
 * Ensures cross-venue access is prevented
 */
export async function verifyOrderVenueAccess(
  orderId: string,
  venueId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, venue_id")
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .maybeSingle();

    if (orderError) {
      logger.warn("[ORDER VENUE VERIFY] Order lookup error", {
        orderId,
        venueId,
        error: orderError.message,
      });
      return { valid: false, error: orderError.message };
    }

    if (!order) {
      logger.warn("[ORDER VENUE VERIFY] Order not found or doesn't belong to venue", {
        orderId,
        venueId,
      });
      return { valid: false, error: "Order not found or access denied" };
    }

    return { valid: true };
  } catch (error) {
    logger.error("[ORDER VENUE VERIFY] Error verifying order venue access", {
      orderId,
      venueId,
      error,
    });
    return { valid: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get authenticated user from request
 * STANDARDIZED: Uses getAuthenticatedUser from @/lib/supabase for consistency
 */
export async function getAuthenticatedUser() {
  return getAuthUser();
}

/**
 * Authorization middleware for API routes
 * Wraps handler with authentication and venue access verification
 */
export interface RouteParams {
  venueId?: string;
  [key: string]: string | undefined;
}

export function withAuthorization(
  handler: (req: NextRequest, context: AuthorizedContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, { params }: { params: RouteParams }) => {
    try {
      // Get authenticated user
      const { user, error: authError } = await getAuthenticatedUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized", message: authError }, { status: 401 });
      }

      // Extract venueId from params or query
      const venueId = params?.venueId || new URL(req.url).searchParams.get("venueId");

      if (!venueId) {
        return NextResponse.json(
          { error: "Bad Request", message: "venueId is required" },
          { status: 400 }
        );
      }

      // Verify venue access
      const access = await verifyVenueAccess(venueId, user.id);

      if (!access) {
        return NextResponse.json(
          { error: "Forbidden", message: "Access denied to this venue" },
          { status: 403 }
        );
      }

      // Call handler with authorized context
      return await handler(req, {
        venue: access.venue,
        user: access.user,
        role: access.role,
        venueId,
      });
    } catch (_error) {
      logger.error("Authorization middleware error", { error: _error });
      return NextResponse.json(
        { error: "Internal Server Error", message: "Authorization failed" },
        { status: 500 }
      );
    }
  };
}

/**
 * Optional authorization - allows unauthenticated requests
 */
export function withOptionalAuth(
  handler: (req: NextRequest, context: AuthorizedContext | null) => Promise<NextResponse>
) {
  return async (req: NextRequest, { params }: { params: RouteParams }) => {
    try {
      // Try to get authenticated user
      const { user } = await getAuthenticatedUser();

      if (!user) {
        // Allow unauthenticated access
        return await handler(req, null);
      }

      // Extract venueId
      const venueId = params?.venueId || new URL(req.url).searchParams.get("venueId");

      if (!venueId) {
        return await handler(req, null);
      }

      // Verify venue access
      const access = await verifyVenueAccess(venueId, user.id);

      if (!access) {
        return await handler(req, null);
      }

      // Call handler with authorized context
      return await handler(req, {
        venue: access.venue,
        user: access.user,
        role: access.role,
        venueId,
      });
    } catch (_error) {
      logger.error("Optional auth middleware error", { error: _error });
      return await handler(req, null);
    }
  };
}

/**
 * Role-based authorization - check if user has specific role
 */
export function requireRole(allowedRoles: string[]) {
  return (context: AuthorizedContext): boolean => {
    return allowedRoles.includes(context.role);
  };
}

/**
 * Owner-only authorization
 */
export function requireOwner(context: AuthorizedContext): boolean {
  return context.role === "owner";
}

/**
 * Staff or owner authorization
 */
export function requireStaffOrOwner(context: AuthorizedContext): boolean {
  return ["owner", "manager", "staff"].includes(context.role);
}
