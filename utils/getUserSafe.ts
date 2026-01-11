/**
 * @fileoverview Safely get authenticated user without throwing errors
 * @module utils/getUserSafe
 */

import { createClient } from "@/lib/supabase";
import { hasServerAuthCookie } from "@/lib/server-utils";

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
    // Check for cookies first
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

     => c.name).join(", "),

    const hasAuthCookie = await hasServerAuthCookie();

    if (!hasAuthCookie) {
      
      return null;
    }

    const supabase = await createClient();

    // Use getUser() instead of getSession() for better security
    // This authenticates with Supabase Auth server instead of just reading cookies
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      
      return null;
    }

    if (!data.user) {
      
      return null;
    }

    

    return data.user;
  } catch (err) {

    return null;
  }
}
