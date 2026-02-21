/**
 * Centralized Authorization Middleware
 * Uses unified get_access_context RPC for all auth/tier/role checks
 * Eliminates 32+ duplicate venue ownership checks across the codebase
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createServerSupabaseWithToken } from "@/lib/supabase";
import { getAuthenticatedUser as getAuthUser } from "@/lib/supabase";
import { normalizeVenueId } from "@/lib/utils/venueId";
import { resolveTierFromDb } from "@/lib/utils/tier";
import { resolveVenueAccess } from "@/lib/auth/resolve-access";

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
 * Resolution order (first success wins):
 *   1. Admin client (resolveVenueAccess) — most reliable, never depends on cookies/JWT.
 *   2. Cookie-based Supabase client → get_access_context RPC
 *   3. Bearer token Supabase client → get_access_context RPC (when request provided)
 *
 * Admin path runs first because cookies/JWT may not be available (API clients,
 * mobile, cross-origin) but the DB always has the source of truth for roles.
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
      tier: resolveTierFromDb(rpc.tier),
      venue_ids: [],
    };
  };

  // 1. Admin client first — never depends on cookies/JWT, always works if user has DB access
  try {
    const resolved = await resolveVenueAccess(userId, normalizedVenueId);
    if (resolved) {
      const { createAdminClient } = await import("@/lib/supabase");
      const admin = createAdminClient();
      const { data: venue, error: venueErr } = await admin
        .from("venues")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .single();

      if (!venueErr && venue) {
        return {
          venue,
          user: { id: userId },
          role: resolved.role,
          tier: resolved.tier,
          venue_ids: [],
        };
      }
    }
  } catch {
    // Admin path failed — continue to cookie/token paths
  }

  // 2. Cookie-based Supabase client
  try {
    const supabase = await createSupabaseClient();
    const result = await tryWithSupabase(supabase);
    if (result) return result;
  } catch {
    // Path 2 failed — continue to path 3
  }

  // 3. Bearer token if provided (API clients, mobile)
  if (request) {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (token) {
      try {
        const tokenSupabase = createServerSupabaseWithToken(token);
        const tokenResult = await tryWithSupabase(tokenSupabase);
        if (tokenResult) return tokenResult;
      } catch {
        // Path 3 failed
      }
    }
  }

  return null;
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
      const venueId = rawVenueId ? (normalizeVenueId(rawVenueId) ?? rawVenueId) : null;

      if (!venueId) {
        return NextResponse.json(
          { error: "Bad Request", message: "venueId is required" },
          { status: 400 }
        );
      }

      // Verify venue access (pass req for Bearer token fallback)
      const access = await verifyVenueAccess(venueId, user.id, req);

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
      const venueId = rawVenueId ? (normalizeVenueId(rawVenueId) ?? rawVenueId) : null;

      if (!venueId) {
        return await handler(req, null);
      }

      // Verify venue access (pass req for Bearer token fallback)
      const access = await verifyVenueAccess(venueId, user.id, req);

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
