/**
 * API Authentication Helper
 *
 * Consistent authentication for all API routes.
 * Uses Authorization header instead of cookies for better reliability.
 */

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

interface AuthResult {
  success: boolean;
  user?: User;
  supabase?: ReturnType<typeof createClient> | unknown;
  error?: string;
}

/**
 * Authenticate API request using Authorization header
 *
 * @example
 * ```ts
 * export async function GET(req: Request) {
 *   const auth = await authenticateRequest(req);
 *   if (!auth.success) {
 *     return NextResponse.json({ error: auth.error }, { status: 401 });
 *   }
 *
 *   const { user, supabase } = auth;
 *   // Use user and supabase client...
 * }
 * ```
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  try {
    // Get auth token from Authorization header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return {
        success: false,
        error: "No authorization token provided",
      };
    }

    // Create Supabase client with the provided token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verify token and get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Invalid or expired token",
      };
    }

    return {
      success: true,
      user,
      supabase,
    };
  } catch (_error) {
    return {
      success: false,
      error: "Authentication failed",
    };
  }
}

/**
 * Verify user has access to a venue (owner or staff)
 */
export async function verifyVenueAccess(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  venueId: string
): Promise<{ hasAccess: boolean; role?: string }> {
  // Check if owner
  const { data: venueAccess } = await supabase
    .from("venues")
    .select("venue_id")
    .eq("venue_id", venueId)
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (venueAccess) {
    return { hasAccess: true, role: "owner" };
  }

  // Check if staff
  const { data: staffAccess } = await supabase
    .from("user_venue_roles")
    .select("role")
    .eq("venue_id", venueId)
    .eq("user_id", userId)
    .maybeSingle();

  if (staffAccess && "role" in staffAccess) {
    return { hasAccess: true, role: staffAccess.role as string };
  }

  return { hasAccess: false };
}
