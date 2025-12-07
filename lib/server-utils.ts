/**
 * Server-side utilities for authentication and database operations
 * These should only be imported in server components and API routes
 */

interface Cookie {
  name: string;
  value: string;
}

interface CookieStore {
  getAll(): Cookie[];
}

/**
 * Check if the request has Supabase auth cookies
 * This helps prevent unnecessary auth calls on requests that obviously won't have a session
 */
export function hasSbAuthCookie(cookies: CookieStore) {
  return cookies.getAll().some((c) => c.name.includes("-auth-token"));
}

/**
 * Server-side utility to check for Supabase auth cookies
 * Use this before making auth calls in server components
 */
export async function hasServerAuthCookie() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  return cookieStore.getAll().some((c) => c.name.includes("-auth-token"));
}

/**
 * Safe server-side auth helper that only calls getUser if auth cookies exist
 * Returns { user: null, error: null } if no auth cookies
 * Uses getUser() instead of getSession() for secure authentication
 */
export async function safeGetUser() {
  const hasAuthCookie = await hasServerAuthCookie();
  if (!hasAuthCookie) {
    return { user: null, error: null };
  }

  const { createServerSupabase } = await import("@/lib/supabase");
  const supabase = await createServerSupabase();
  return await supabase.auth.getUser();
}
