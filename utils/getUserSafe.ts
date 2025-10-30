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
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      logger.warn("[getUserSafe] Session error:", {
        error: error.message,
        code: error.status,
      });
      return null;
    }

    if (!data.session?.user) {
      logger.warn("[getUserSafe] No user in session - session may be expired");
      return null;
    }

    logger.info("[getUserSafe] ✅ User authenticated successfully:", {
      userId: data.session.user.id,
      email: data.session.user.email,
    });

    return data.session.user;
  } catch (err) {
    logger.error("[getUserSafe] Unexpected error:", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
