/**
 * @fileoverview Canonical Supabase client factory
 * @module lib/supabase
 *
 * This is the ONLY place to create Supabase clients. Import from here everywhere.
 * - Browser clients: Use `supabaseBrowser()` for client-side code
 * - Server clients: Use `createClient()` for server components and API routes
 */

import { createServerClient as createSSRServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createBrowserClient } from "@supabase/supabase-js";

/**
 * Gets the Supabase URL from environment variables
 * @returns {string} The Supabase project URL
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_URL is not set
 */
export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  return url;
}

/**
 * Gets the Supabase anonymous key from environment variables
 * @returns {string} The Supabase anonymous API key
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_ANON_KEY is not set
 */
export function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  return key;
}

// Singleton browser client to prevent multiple instances
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Creates or returns singleton browser Supabase client
 * Safe for both client and server-side rendering
 * @returns {SupabaseClient} Supabase client instance
 */
export function supabaseBrowser() {
  if (typeof window === "undefined") {
    // Server-side: return a new instance (can't use singleton on server)
    return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: false },
    });
  }

  // Client-side: use singleton
  if (!browserClient) {
    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true, // Enable auto-refresh - this is the proper way!
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });

    // Still override getSession to gracefully handle edge cases where refresh fails
    const originalGetSession = browserClient.auth.getSession.bind(browserClient.auth);
    browserClient.auth.getSession = async () => {
      try {
        return await originalGetSession();
      } catch (err) {
        // Only catch truly invalid tokens (user signed out elsewhere, token revoked, etc)
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (
          errorMessage.includes("refresh_token_not_found") ||
          errorMessage.includes("Invalid Refresh Token")
        ) {
          // Clear local storage and return null - user needs to sign in again
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(`sb-${getSupabaseUrl()}-auth-token`);
          }
          return { data: { session: null }, error: null };
        }
        throw err; // Re-throw unexpected errors
      }
    };
  }

  return browserClient;
}

// Server in Route Handlers / Server Components with cookies
export function supabaseServer(cookies: {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, opts: CookieOptions) => void;
}) {
  const client = createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get: (name) => cookies.get(name),
      set: (name, value, options) => cookies.set(name, value, options),
      remove: (name, options) => cookies.set(name, "", { ...options, maxAge: 0 }),
    },
    auth: {
      persistSession: false, // Don't persist session on server
      autoRefreshToken: false, // CRITICAL: Don't auto-refresh tokens on server
      detectSessionInUrl: false, // Don't detect session in URL on server
      storage: undefined, // No storage on server
      storageKey: undefined, // No storage key
    },
  });

  // Override getSession method to handle refresh token errors gracefully
  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = async () => {
    try {
      return await originalGetSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("refresh_token_not_found") ||
        errorMessage.includes("Invalid Refresh Token") ||
        errorMessage.includes("refresh_token")
      ) {
        return { data: { session: null }, error: null };
      }
      throw err;
    }
  };

  // Also override getUser to prevent refresh token errors
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (jwt?: string) => {
    try {
      return await originalGetUser(jwt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("refresh_token_not_found") ||
        errorMessage.includes("Invalid Refresh Token") ||
        errorMessage.includes("refresh_token")
      ) {
        return { data: { user: null }, error: null } as unknown as Awaited<
          ReturnType<typeof originalGetUser>
        >;
      }
      throw err;
    }
  };

  return client;
}

// Admin (service role) — server-only
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createBrowserClient(getSupabaseUrl(), key, { auth: { persistSession: false } });
}

// Backward compatibility exports
// This will be async for server, sync for browser
export const createAdminClient = supabaseAdmin;

/**
 * Context-aware createClient - works in both browser and server
 * Returns browser client synchronously on client-side
 * Returns server client async on server-side
 */
export async function createClient() {
  // If on browser, return browser client
  if (typeof window !== "undefined") {
    return supabaseBrowser();
  }

  // If on server, return server client with cookies
  return createServerSupabase();
}

/**
 * Checks if a JWT token is expired or invalid
 */
function isJWTExpiredOrInvalid(token: string | undefined): boolean {
  if (!token || token === "" || token === "undefined" || token === "null") {
    return true;
  }

  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return true;
    }

    // Decode the payload (second part) - handle both browser and Node.js
    let payload;
    if (typeof window !== "undefined") {
      payload = JSON.parse(atob(parts[1]));
    } else {
      payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    }
    const exp = payload.exp;

    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    if (exp && exp * 1000 < Date.now()) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

// Server client factory with cookies (CONSOLIDATED - single source of truth)
export async function createServerSupabase() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  // Get all cookies and identify auth-related ones
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(
    (c) =>
      c.name.includes("sb-") &&
      (c.name.includes("access-token") || c.name.includes("refresh-token"))
  );

  // Find the access token cookie to check if it's expired
  const accessTokenCookie = authCookies.find((c) => c.name.includes("access-token"));

  // Proactively clean up expired/invalid tokens to prevent errors
  if (accessTokenCookie && isJWTExpiredOrInvalid(accessTokenCookie.value)) {
    // Token is expired or invalid - clear all auth cookies
    for (const cookie of authCookies) {
      try {
        cookieStore.delete(cookie.name);
      } catch {
        // Silently handle any cookie deletion errors
      }
    }
  }

  // Get cookie domain from environment
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const COOKIE_DOMAIN = new URL(baseUrl).hostname;

  const client = createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set(name, value, {
            ...options,
            domain: COOKIE_DOMAIN,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            httpOnly: false,
            path: "/",
          });
        } catch {
          // Silent error handling for cookie context
        }
      },
      remove: (name, options) => {
        try {
          cookieStore.set(name, "", {
            ...options,
            domain: COOKIE_DOMAIN,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 0,
          });
        } catch {
          // Silent error handling for cookie context
        }
      },
    },
    auth: {
      persistSession: false, // Don't persist session on server
      autoRefreshToken: false, // CRITICAL: Don't auto-refresh tokens on server
      detectSessionInUrl: false, // Don't detect session in URL on server
      storage: undefined, // No storage on server
      flowType: "pkce", // Use PKCE flow
    },
  });

  // Override getSession method to handle refresh token errors gracefully
  const originalGetSession = client.auth.getSession.bind(client.auth);
  client.auth.getSession = async () => {
    try {
      return await originalGetSession();
    } catch (err) {
      // Silently catch refresh token errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("refresh_token_not_found") ||
        errorMessage.includes("Invalid Refresh Token") ||
        errorMessage.includes("refresh_token")
      ) {
        // Completely suppress these expected errors
        return { data: { session: null }, error: null };
      }
      throw err; // Re-throw unexpected errors
    }
  };

  // Also override getUser to prevent refresh token errors
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (jwt?: string) => {
    try {
      return await originalGetUser(jwt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (
        errorMessage.includes("refresh_token_not_found") ||
        errorMessage.includes("Invalid Refresh Token") ||
        errorMessage.includes("refresh_token")
      ) {
        return { data: { user: null }, error: null } as unknown as Awaited<
          ReturnType<typeof originalGetUser>
        >;
      }
      throw err;
    }
  };

  return client;
}

// Alias for backward compatibility
export async function createSupabaseClient() {
  return createServerSupabase();
}

// Context-aware createClient that works in both browser and server
export function createClientContextAware() {
  if (typeof window !== "undefined") {
    return supabaseBrowser();
  }
  // For server-side, this will need to be awaited with cookies
  throw new Error(
    "createClientContextAware cannot be used on server without cookies. Use createServerSupabase() instead."
  );
}

/**
 * Check if valid auth cookies exist
 * This prevents unnecessary API calls that would fail with refresh token errors
 */
async function hasValidAuthCookies(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // Check for access token cookie (the main auth cookie)
    const accessTokenCookie = allCookies.find(
      (c) => c.name.includes("sb-") && c.name.includes("access-token") && c.value && c.value !== ""
    );

    return !!accessTokenCookie;
  } catch {
    return false;
  }
}

// Get authenticated user (server-side)
export async function getAuthenticatedUser() {
  try {
    // First check if we have valid auth cookies to avoid unnecessary errors
    const hasAuth = await hasValidAuthCookies();
    if (!hasAuth) {
      return { user: null, error: null };
    }

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const supabase = supabaseServer({
      get: (name) => cookieStore.get(name)?.value,
      set: () => {},
    });
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const user = session?.user;

    // Silently handle refresh token errors - don't log them
    if (error) {
      if (
        error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Invalid Refresh Token")
      ) {
        // This is expected when tokens expire, just return no user
        return { user: null, error: null };
      }
      return { user: null, error: error.message };
    }

    return { user, error: null };
  } catch (err) {
    // Catch and suppress refresh token errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (
      errorMessage?.includes("refresh_token_not_found") ||
      errorMessage?.includes("Invalid Refresh Token")
    ) {
      return { user: null, error: null };
    }
    return { user: null, error: "Failed to get authenticated user" };
  }
}

// Get session (server-side)
export async function getSession() {
  try {
    // First check if we have valid auth cookies to avoid unnecessary errors
    const hasAuth = await hasValidAuthCookies();
    if (!hasAuth) {
      return { session: null, error: null };
    }

    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const supabase = supabaseServer({
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set(name, value, {
            ...options,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            httpOnly: false,
            path: "/",
          });
        } catch {
          // Silent error handling for cookie context
        }
      },
    });
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    // Silently handle refresh token errors - don't log them
    if (error) {
      if (
        error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Invalid Refresh Token")
      ) {
        // This is expected when tokens expire, just return no session
        return { session: null, error: null };
      }
      return { session: null, error: error.message };
    }

    return { session, error: null };
  } catch (err) {
    // Catch and suppress refresh token errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (
      errorMessage?.includes("refresh_token_not_found") ||
      errorMessage?.includes("Invalid Refresh Token")
    ) {
      return { session: null, error: null };
    }
    return { session: null, error: "Failed to get session" };
  }
}

/**
 * Safe wrapper for getSession() that handles refresh token errors gracefully
 * Use this instead of calling supabase.auth.getSession() directly
 */
export async function getSessionSafe(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  try {
    const { data, error } = await supabase.auth.getSession();

    // Silently handle expected refresh token errors
    if (error) {
      if (
        error.message?.includes("refresh_token_not_found") ||
        error.message?.includes("Invalid Refresh Token")
      ) {
        return { session: null, user: null, error: null };
      }
      // Return unexpected errors
      return { session: null, user: null, error };
    }

    return {
      session: data.session,
      user: data.session?.user || null,
      error: null,
    };
  } catch (err) {
    // Catch any thrown errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (
      errorMessage.includes("refresh_token_not_found") ||
      errorMessage.includes("Invalid Refresh Token")
    ) {
      return { session: null, user: null, error: null };
    }
    return { session: null, user: null, error: err };
  }
}

// Export supabase instance for backward compatibility (getter to ensure singleton)
export const supabase = (() => supabaseBrowser())();

// Clear authentication storage (client-side only)
export function clearAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  // Clear localStorage
  localStorage.removeItem("supabase.auth.token");
  localStorage.removeItem("sb-auth-token");

  // Clear sessionStorage
  sessionStorage.removeItem("supabase.auth.token");
  sessionStorage.removeItem("sb-auth-token");

  // Clear cookies
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
}

// Alias for backward compatibility
export const clearSupabaseAuth = clearAuthStorage;
