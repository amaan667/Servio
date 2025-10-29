/**
 * @fileoverview Safely get authenticated user without throwing errors
 * @module utils/getUserSafe
 */

import { createServerSupabase } from "@/lib/supabase";
import { cookies } from "next/headers";

/**
 * Safely retrieves the currently authenticated user
 * Returns null instead of throwing errors for unauthenticated requests
 *
 * @returns {Promise<User | null>} The authenticated user or null
 *
 * @example
 * ```ts
 * const user = await getUserSafe();
 * if (!user) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * ```
 */
export async function getUserSafe() {
  try {
    // Get cookies from the request
    const cookieStore = await cookies();

    // Create a server client with proper cookie handling
    const supabase = await createServerSupabase();

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.log("[AUTH DEBUG] getSession error:", error.message);
      return null;
    }

    if (!data.session?.user) {
      console.log("[AUTH DEBUG] No session or user found");
      return null;
    }

    console.log("[AUTH DEBUG] User authenticated:", data.session.user.id);
    return data.session.user;
  } catch (error) {
    // If anything goes wrong, return null instead of throwing
    console.log(
      "[AUTH DEBUG] getUserSafe exception:",
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
