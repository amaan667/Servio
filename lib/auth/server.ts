import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase";

/**
 * SECURE: Get the authenticated user on the server side
 * Uses getUser() instead of getSession() for better security
 */
export async function getAuthUser() {
  const { user, error } = await getAuthenticatedUser();

  if (error) {
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
      return { user: null, error };
    }

    if (!user) {
      return { user: null, error: "No session" };
    }

    return { user, error: null };
  } catch (err) {
    return { user: null, error: "Authentication failed" };
  }
}
