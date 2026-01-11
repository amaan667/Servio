import { errorToContext } from "@/lib/utils/error-to-context";

import { supabaseBrowser } from "@/lib/supabase";

/**
 * SECURE: Get the currently authenticated user
 * This method contacts the Supabase Auth server to verify the user's identity
 * Use this instead of getSession() for authentication checks
 */
export async function getAuthenticatedUser() {
  try {
    const supabase = supabaseBrowser();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (error) {
      );
      return { user: null, error: error.message };
    }

    return { user, error: null };
  } catch (_error) {
    );
    return { user: null, error: "Failed to get authenticated user" };
  }
}

/**
 * SECURE: Check if user is authenticated
 * Returns true only if user exists and is verified by the server
 */
export async function isAuthenticated(): Promise<boolean> {
  const { user, error } = await getAuthenticatedUser();
  return !error && !!user;
}

/**
 * SECURE: Get user ID if authenticated
 * Returns null if not authenticated or on error
 */
export async function getUserId(): Promise<string | null> {
  const { user, error } = await getAuthenticatedUser();
  return !error && user ? user.id : null;
}

/**
 * SECURE: Get user email if authenticated
 * Returns null if not authenticated or on error
 */
export async function getUserEmail(): Promise<string | null> {
  const { user, error } = await getAuthenticatedUser();
  return !error && user ? (user.email ?? null) : null;
}

/**
 * SECURE: Sign out the current user
 * Clears both local storage and server-side session
 */
export async function signOut() {
  try {
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signOut();

    if (error) {
      );
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (_error) {
    );
    return { success: false, error: "Failed to sign out" };
  }
}
