import { errorToContext } from "@/lib/utils/error-to-context";

import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase";
import { logger } from "@/lib/logger";

/**
 * SECURE: Get the authenticated user on the server side
 * Uses getUser() instead of getSession() for better security
 */
export async function getAuthUser() {
  const { user, error } = await getAuthenticatedUser();

  if (error) {
    logger.error("[AUTH SERVER] Error getting authenticated user:", errorToContext(error));
    return null;
  }

  return user;
}

/**
 * SECURE: Require authentication - redirects to sign-in if not authenticated
 */
export async function requireAuth(redirectTo: string = "/sign-in") {
  const user = await getAuthUser();

  if (!user) {
    redirect(redirectTo);
  }

  return user;
}

/**
 * SECURE: Check if user is authenticated without redirecting
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getAuthUser();
  return !!user;
}

/**
 * SECURE: Get user data for API routes
 */
export async function getAuthUserForAPI() {
  try {
    const { user, error } = await getAuthenticatedUser();

    if (error) {
      logger.error("[AUTH API] Authentication error:", error);
      return { user: null, error };
    }

    if (!user) {
      logger.warn("[AUTH API] No user session found");
      return { user: null, error: "No session" };
    }

    logger.info("[AUTH API] User authenticated successfully:", { userId: user.id });
    return { user, error: null };
  } catch (err) {
    logger.error("[AUTH API] Unexpected error:", errorToContext(err));
    return { user: null, error: "Authentication failed" };
  }
}
