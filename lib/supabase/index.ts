/**
 * @fileoverview Canonical Supabase client factory
 * @module lib/supabase
 *
 * This is the ONLY place to create Supabase clients. Import from here everywhere.
 * - Browser clients: Use `supabaseBrowser()` for client-side code
 * - Server clients: Use `createClient()` for server components and API routes
 * - Mobile Safari optimizations included for cookie/storage handling
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
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing. Please set this environment variable in your deployment."
    );
  }
  return url;
}

/**
 * Gets the Supabase anonymous key from environment variables
 * @returns {string} The Supabase anonymous API key
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_ANON_KEY is not set
 */
export function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Please set this environment variable in your deployment."
    );
  }
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
    const projectRef = getSupabaseUrl().match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "default";

    // Detect mobile Safari - it has stricter cookie/storage policies
    const isMobileSafari =
      typeof navigator !== "undefined" &&
      /iPhone|iPad|iPod/.test(navigator.userAgent) &&
      /Safari/.test(navigator.userAgent) &&
      !/Chrome|CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

    // Test if storage is actually available (private browsing can block it)
    const isStorageAvailable = () => {
      try {
        const testKey = "__supabase_storage_test__";
        localStorage.setItem(testKey, "test");
        localStorage.removeItem(testKey);
        console.log("[MOBILE SAFARI] ✅ localStorage is available");
        return true;
      } catch (error) {
        console.error("[MOBILE SAFARI] ❌ localStorage is BLOCKED:", error);
        return false;
      }
    };

    // Custom storage implementation for mobile Safari that handles restrictions
    const createMobileSafariStorage = () => {
      const storageAvailable = isStorageAvailable();

      console.log("[MOBILE SAFARI] Creating custom storage, available:", storageAvailable);

      return {
        getItem: (key: string) => {
          try {
            if (storageAvailable) {
              const value = localStorage.getItem(key);
              console.log(`[MOBILE SAFARI] getItem(${key}):`, value ? "found" : "not found");
              return value;
            }
            // Fallback to cookies if localStorage unavailable
            const cookies = document.cookie.split(";");
            const cookie = cookies.find((c) => c.trim().startsWith(`${key}=`));
            const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
            console.log(
              `[MOBILE SAFARI] getItem from cookie(${key}):`,
              value ? "found" : "not found"
            );
            return value;
          } catch (error) {
            console.error(`[MOBILE SAFARI] getItem(${key}) error:`, error);
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            if (storageAvailable) {
              localStorage.setItem(key, value);
              console.log(
                `[MOBILE SAFARI] ✅ setItem to localStorage(${key}):`,
                value.substring(0, 50) + "..."
              );
            } else {
              // Fallback to cookies with extended expiry
              const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
              document.cookie = `${key}=${encodeURIComponent(value)}; expires=${expires}; path=/; secure; samesite=lax`;
              console.log(
                `[MOBILE SAFARI] ✅ setItem to cookie(${key}):`,
                value.substring(0, 50) + "..."
              );
            }
          } catch (e) {
            console.error(`[MOBILE SAFARI] ❌ setItem(${key}) error:`, e);
          }
        },
        removeItem: (key: string) => {
          try {
            if (storageAvailable) {
              localStorage.removeItem(key);
            }
            // Also remove from cookies
            document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            console.log(`[MOBILE SAFARI] removeItem(${key})`);
          } catch (error) {
            console.error(`[MOBILE SAFARI] removeItem(${key}) error:`, error);
          }
        },
      };
    };

    console.log("[MOBILE SAFARI] Browser client config:", {
      isMobileSafari,
      projectRef,
      userAgent: navigator.userAgent,
      hasCustomStorage: isMobileSafari,
    });

    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: true,
        detectSessionInUrl: true,
        autoRefreshToken: true,
        flowType: "pkce", // PKCE is required for Supabase OAuth
        // Mobile Safari: Use custom storage that handles private browsing/restrictions
        // Desktop: Let Supabase use default storage
        storage: isMobileSafari ? createMobileSafariStorage() : undefined,
        storageKey: isMobileSafari ? `sb-${projectRef}-auth-token` : undefined,
      },
      global: {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    });

    console.log("[MOBILE SAFARI] ✅ Browser client created successfully");

    // Handle session management for multiple devices
    // Each device should maintain its own session independently
    const originalGetSession = browserClient.auth.getSession.bind(browserClient.auth);
    browserClient.auth.getSession = async () => {
      try {
        const result = await originalGetSession();
        // If session exists but is expired, try to refresh it automatically
        if (result.data?.session && browserClient) {
          const expiresAt = result.data.session.expires_at;
          const now = Math.floor(Date.now() / 1000);
          // If token expires in less than 60 seconds, refresh it proactively
          if (expiresAt && expiresAt - now < 60) {
            try {
              const { data: refreshed } = await browserClient.auth.refreshSession();
              if (refreshed?.session) {
                return { data: { session: refreshed.session }, error: null };
              }
            } catch (_refreshError) {
              // Refresh failed, return original session
            }
          }
        }
        return result;
      } catch (_err) {
        // Only catch truly invalid tokens (user signed out elsewhere, token revoked, etc)
        const errorMessage = _err instanceof Error ? _err.message : String(_err);
        if (
          errorMessage.includes("refresh_token_not_found") ||
          errorMessage.includes("Invalid Refresh Token")
        ) {
          // Don't clear storage for multi-device - might be valid on another device
          // Just return null session
          return { data: { session: null }, error: null };
        }
        throw _err; // Re-throw unexpected errors
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
  return createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get: (name) => cookies.get(name),
      set: (name, value, options) => cookies.set(name, value, options),
      remove: (name, options) => cookies.set(name, "", { ...options, maxAge: 0 }),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: undefined,
      storageKey: undefined,
    },
    global: {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  });
}

// Admin (service role) — server-only
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createBrowserClient(getSupabaseUrl(), key, { auth: { persistSession: false } });
}

// Backward compatibility export
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

// Server client factory with cookies (CONSOLIDATED - single source of truth)
export async function createServerSupabase() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const { logger } = await import("@/lib/logger");

  const client = createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        const allCookies = cookieStore.getAll();
        logger.info("[createServerSupabase] getAll() called", {
          count: allCookies.length,
          names: allCookies.map((c) => c.name).join(", "),
        });
        return allCookies;
      },
      setAll(cookiesToSet) {
        logger.info("[createServerSupabase] setAll() called - Attempting to set cookies:", {
          count: cookiesToSet.length,
          names: cookiesToSet.map((c) => c.name).join(", "),
        });

        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            logger.info("[createServerSupabase] Setting cookie:", {
              name,
              valueLength: value?.length || 0,
              hasValue: !!value,
              options: {
                httpOnly: options?.httpOnly,
                sameSite: options?.sameSite,
                secure: options?.secure,
                path: options?.path,
              },
            });

            cookieStore.set(name, value, {
              ...options,
              httpOnly: false, // Must be false for Supabase to read from client
              sameSite: "lax",
              secure: true, // Always use secure in production - critical for mobile Safari
              path: "/",
            });
          });

          logger.info("[createServerSupabase] ✅ All cookies set successfully", {
            count: cookiesToSet.length,
          });
        } catch (error) {
          logger.error("[createServerSupabase] ❌ Failed to set cookies:", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
    },
    global: {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  });

  return client;
}

// Read-only server client for layouts/pages where cookie modification is not allowed
export async function createServerSupabaseReadOnly() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // NO-OP: Don't try to set cookies in read-only mode
        // This prevents "Cookies can only be modified in a Server Action or Route Handler" errors
      },
    },
  });
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

    // Check for auth token cookies (chunked as .0, .1, etc or full token)
    const hasAuthToken = allCookies.some(
      (c) =>
        c.name.includes("sb-") &&
        c.name.includes("auth-token") &&
        !c.name.includes("refresh") && // Not just the refresh token
        c.value &&
        c.value !== ""
    );

    return hasAuthToken;
  } catch {
    return false;
  }
}

// Get authenticated user (server-side)
export async function getAuthenticatedUser() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    const supabase = supabaseServer({
      get: (name) => {
        // Guard against undefined cookie names
        if (!name || typeof name !== "string") {
          return undefined;
        }
        try {
          const cookie = cookieStore.get(name);
          return cookie?.value;
        } catch {
          return undefined;
        }
      },
      set: () => {
        /* Empty - read-only mode */
      },
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
      console.log("[AUTH DEBUG] Auth error:", error.message);
      return { user: null, error: error.message };
    }

    if (!user) {
      // Check if we have any auth cookies to provide better error message
      const hasAuth = await hasValidAuthCookies();
      if (!hasAuth) {
        console.log("[AUTH DEBUG] No valid auth cookies found");
        return { user: null, error: "No authentication cookies found. Please sign in again." };
      }
      console.log("[AUTH DEBUG] Auth cookies exist but no session");
      return { user: null, error: "Session expired. Please sign in again." };
    }

    return { user, error: null };
  } catch (_err) {
    // Catch and suppress refresh token errors
    const errorMessage = _err instanceof Error ? _err.message : String(_err);
    if (
      errorMessage?.includes("refresh_token_not_found") ||
      errorMessage?.includes("Invalid Refresh Token") ||
      errorMessage?.includes("Cannot read properties of undefined")
    ) {
      return { user: null, error: null };
    }
    console.log("[AUTH DEBUG] Auth exception:", errorMessage);
    return { user: null, error: "Failed to get authenticated user" };
  }
}

// Get session (server-side)
export async function getSession() {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const supabase = supabaseServer({
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set(name, value, {
            ...options,
            sameSite: "lax",
            secure: true, // Always use secure - critical for mobile Safari
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
  } catch (_err) {
    // Catch and suppress refresh token errors
    const errorMessage = _err instanceof Error ? _err.message : String(_err);
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
  } catch (_err) {
    // Catch any thrown errors
    const errorMessage = _err instanceof Error ? _err.message : String(_err);
    if (
      errorMessage.includes("refresh_token_not_found") ||
      errorMessage.includes("Invalid Refresh Token")
    ) {
      return { session: null, user: null, error: null };
    }
    return { session: null, user: null, error: _err };
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
  localStorage.removeItem("sb-auth-session");

  // Clear sessionStorage - including all dashboard caches
  sessionStorage.removeItem("supabase.auth.token");
  sessionStorage.removeItem("sb-auth-token");

  // Clear all dashboard-related caches
  Object.keys(sessionStorage).forEach((key) => {
    if (
      key.startsWith("dashboard_user_") ||
      key.startsWith("dashboard_venue_") ||
      key.startsWith("user_role_") ||
      key.startsWith("venue_id_")
    ) {
      sessionStorage.removeItem(key);
    }
  });

  // Clear cookies
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
}

// Alias for backward compatibility
export const clearSupabaseAuth = clearAuthStorage;
