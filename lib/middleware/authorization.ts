/**
 * Centralized Authorization Middleware
 * Uses unified get_access_context RPC for all auth/tier/role checks
 * Eliminates 32+ duplicate venue ownership checks across the codebase
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { getAuthenticatedUser as getAuthUser } from "@/lib/supabase";
import { getAccessContext } from "@/lib/access/getAccessContext";

export interface Venue {

}

export interface User {

}

export interface VenueAccess {

}

export interface AuthorizedContext {

}

/**
 * Verify user has access to venue (owner or staff)
 * Uses unified get_access_context RPC for single database call
 */
export async function verifyVenueAccess(

    }

    // Verify the access context matches the requested user
    if (accessContext.user_id !== userId) {
      
      return null;
    }

    // Verify venue access
    if (accessContext.venue_id !== venueId) {
      
      return null;
    }

    // Get venue details (we still need the full venue object for backward compatibility)
    const supabase = await createSupabaseClient();
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", venueId)
      .single();

    if (venueError || !venue) {
      
      return null;
    }

    

    return {
      venue,
      user: { id: userId },

    };
  } catch (error) {

    return null;
  }
}

/**
 * Verify venue exists and is valid (for public routes)
 * This is a lightweight check that doesn't require user authentication
 * but ensures the venue exists and is accessible
 */
export async function verifyVenueExists(

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
      
      return { valid: false, error: venueError.message };
    }

    if (!venue) {
      
      return { valid: false, error: "Venue not found" };
    }

    return { valid: true, venue };
  } catch (error) {
    
    return { valid: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Verify order belongs to venue (for public routes)
 * Ensures cross-venue access is prevented
 */
export async function verifyOrderVenueAccess(

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
      
      return { valid: false, error: orderError.message };
    }

    if (!order) {
      
      return { valid: false, error: "Order not found or access denied" };
    }

    return { valid: true };
  } catch (error) {
    
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

        venueId,

    } catch (_error) {
      
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

        venueId,

    } catch (_error) {
      
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
