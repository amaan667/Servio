/**
 * @fileoverview Safely get authenticated user without throwing errors
 * @module utils/getUserSafe
 */

import { createClient } from "@/lib/supabase";
import { hasServerAuthCookie } from "@/lib/server-utils";
import { logger } from "@/lib/logger";

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

    logger.debug("[getUserSafe] Checking cookies:", {
      totalCookies: allCookies.length,
      cookieNames: allCookies.map((c) => c.name).join(", "),
      hasAuthToken: allCookies.some((c) => c.name.includes("-auth-token")),
    });

    const hasAuthCookie = await hasServerAuthCookie();

    if (!hasAuthCookie) {
      logger.warn("[getUserSafe] No auth cookie found - user may not be logged in");
      return null;
    }

    const supabase = await createClient();

    // Use getUser() instead of getSession() for better security
    // This authenticates with Supabase Auth server instead of just reading cookies
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      logger.warn("[getUserSafe] Auth error:", {
        error: error.message,
      });
      return null;
    }

    if (!data.user) {
      logger.warn("[getUserSafe] No user authenticated");
      return null;
    }

    logger.debug("[getUserSafe] User authenticated successfully:", {
      userId: data.user.id,
      email: data.user.email,
    });

    return data.user;
  } catch (err) {
    logger.error("[getUserSafe] Unexpected error:", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
