/**
 * Centralized Authorization Middleware
 * Uses unified get_access_context RPC for all auth/tier/role checks
 * Eliminates 32+ duplicate venue ownership checks across the codebase
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseClient,
  createServerSupabaseWithToken,
  createAdminClient,
} from "@/lib/supabase";
import { getAuthenticatedUser as getAuthUser } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";

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
  tier: string;
  venue_ids: string[];
}

export interface AuthorizedContext {
  venue: Venue;
  user: User;
  role: string;
  venueId: string;
  tier: string;
  venue_ids: string[];
}

/**
 * Verify user has access to venue (owner or staff)
 * Single path: get_access_context RPC for role/tier (dashboard and API routes).
 * When request is provided with Bearer token, uses token when cookies are empty.
 */
export async function verifyVenueAccess(
  venueId: string,
  userId: string,
  request?: NextRequest
): Promise<VenueAccess | null> {
  const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

  const tryWithSupabase = async (
    supabase: Awaited<ReturnType<typeof createSupabaseClient>>
  ): Promise<VenueAccess | null> => {
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("venue_id", normalizedVenueId)
      .single();

    if (venueError || !venue) return null;

    const { data: ctx, error: rpcError } = await supabase.rpc("get_access_context", {
      p_venue_id: normalizedVenueId,
    });

    if (rpcError || !ctx) return null;

    const rpc = ctx as { user_id?: string; role?: string; tier?: string };
    if (!rpc.user_id || !rpc.role || rpc.user_id !== userId) return null;

    return {
      venue,
      user: { id: userId },
      role: rpc.role,
      tier: (rpc.tier?.toLowerCase()?.trim() || "starter") as string,
      venue_ids: [],
    };
  };

  try {
    // 1. Try cookie-based Supabase client (primary path)
    const supabase = await createSupabaseClient();
    const result = await tryWithSupabase(supabase);
    if (result) return result;

    // 2. Cookie-based auth failed. Try Bearer token if provided.
    if (request) {
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (token) {
        const tokenSupabase = createServerSupabaseWithToken(token);
        const tokenResult = await tryWithSupabase(tokenSupabase);
        if (tokenResult) return tokenResult;
      }
    }

    // 3. Both cookie and Bearer token failed. Fall back to admin client.
    //    The user's identity is already verified by middleware (x-user-id header),
    //    so we can safely query the database directly to get venue access + tier.
    try {
      const admin = createAdminClient();

      // Get venue data
      const { data: venue, error: venueErr } = await admin
        .from("venues")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .single();

      if (venueErr || !venue) return null;

      // Check if user is the venue owner
      let userRole: string | null = null;
      if (venue.owner_user_id === userId) {
        userRole = "owner";
      } else {
        // Check user_venue_roles for staff access
        const { data: roleData } = await admin
          .from("user_venue_roles")
          .select("role")
          .eq("venue_id", normalizedVenueId)
          .eq("user_id", userId)
          .maybeSingle();

        if (roleData?.role) {
          userRole = roleData.role;
        }
      }

      if (!userRole) return null;

      // Resolve tier: prefer organization's subscription_tier (authoritative, updated
      // by Stripe webhooks) over venue's subscription_tier (may be stale if sync missed).
      let tier = (venue.subscription_tier?.toLowerCase()?.trim() || "starter") as string;

      if (venue.organization_id) {
        const { data: orgData } = await admin
          .from("organizations")
          .select("subscription_tier")
          .eq("id", venue.organization_id)
          .maybeSingle();

        if (orgData?.subscription_tier) {
          const orgTier = orgData.subscription_tier.toLowerCase().trim();
          if (["starter", "pro", "enterprise"].includes(orgTier)) {
            tier = orgTier;
          }
        }
      }

      return {
        venue,
        user: { id: userId },
        role: userRole,
        tier,
        venue_ids: [],
      };
    } catch {
      // Admin fallback also failed
      return null;
    }
  } catch {
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
    const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;
    const supabase = await createSupabaseClient();

    // Use authenticated client which respects RLS
    // For public routes, this will still work if RLS allows public read access
    const { data: venue, error: venueError } = await supabase
      .from("venues")
      .select("venue_id, owner_user_id, name, created_at, updated_at")
      .eq("venue_id", normalizedVenueId)
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
  orderId: string,
  venueId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;
    const supabase = await createSupabaseClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, venue_id")
      .eq("id", orderId)
      .eq("venue_id", normalizedVenueId)
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

      // Extract venueId from params or query; normalize for DB/context consistency
      const rawVenueId = params?.venueId || new URL(req.url).searchParams.get("venueId");
      const venueId = rawVenueId ? normalizeVenueId(rawVenueId) ?? rawVenueId : null;

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

      // Call handler with authorized context (venueId normalized)
      return await handler(req, {
        venue: access.venue,
        user: access.user,
        role: access.role,
        venueId,
        tier: access.tier,
        venue_ids: access.venue_ids,
      });
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

      // Extract venueId; normalize for DB/context consistency
      const rawVenueId = params?.venueId || new URL(req.url).searchParams.get("venueId");
      const venueId = rawVenueId ? normalizeVenueId(rawVenueId) ?? rawVenueId : null;

      if (!venueId) {
        return await handler(req, null);
      }

      // Verify venue access
      const access = await verifyVenueAccess(venueId, user.id);

      if (!access) {
        return await handler(req, null);
      }

      // Call handler with authorized context (venueId normalized)
      return await handler(req, {
        venue: access.venue,
        user: access.user,
        role: access.role,
        venueId,
        tier: access.tier,
        venue_ids: access.venue_ids,
      });
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
