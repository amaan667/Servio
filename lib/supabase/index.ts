/**
 * @fileoverview Canonical Supabase client factory
 * @module lib/supabase
 * 
 * This is the ONLY place to create Supabase clients. Import from here everywhere.
 * - Browser clients: Use `supabaseBrowser()` for client-side code
 * - Server clients: Use `createClient()` for server components and API routes
 */

import { createServerClient as createSSRServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createBrowserClient } from '@supabase/supabase-js';

/**
 * Gets the Supabase URL from environment variables
 * @returns {string} The Supabase project URL
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_URL is not set
 */
export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
  return url;
}

/**
 * Gets the Supabase anonymous key from environment variables
 * @returns {string} The Supabase anonymous API key
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_ANON_KEY is not set
 */
export function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
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
  if (typeof window === 'undefined') {
    // Server-side: return a new instance (can't use singleton on server)
    return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: false },
    });
  }
  
  // Client-side: use singleton
  if (!browserClient) {
    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { persistSession: true, detectSessionInUrl: true },
    });
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
      remove: (name, options) => cookies.set(name, '', { ...options, maxAge: 0 }),
    },
    auth: {
      persistSession: false, // Don't persist session on server
      autoRefreshToken: false, // Don't auto-refresh tokens on server
      detectSessionInUrl: false, // Don't detect session in URL on server
    },
  });
}

// Admin (service role) — server-only
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  return createBrowserClient(getSupabaseUrl(), key, { auth: { persistSession: false } });
}

// Backward compatibility exports
export const createClient = supabaseBrowser;
export const createAdminClient = supabaseAdmin;

// Server client factory with cookies (CONSOLIDATED - single source of truth)
export async function createServerSupabase() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  
  // Get cookie domain from environment
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const COOKIE_DOMAIN = new URL(baseUrl).hostname;
  
  return createSSRServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set(name, value, {
            ...options,
            domain: COOKIE_DOMAIN,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: false,
            path: '/',
          });
        } catch {
          // Silent error handling for cookie context
        }
      },
      remove: (name, options) => {
        try {
          cookieStore.set(name, '', { 
            ...options, 
            domain: COOKIE_DOMAIN,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0 
          });
        } catch {
          // Silent error handling for cookie context
        }
      },
    },
    auth: {
      flowType: 'pkce', // Enable PKCE flow for better security
      persistSession: false, // Don't persist session on server
      autoRefreshToken: false, // Don't auto-refresh tokens on server
      detectSessionInUrl: false, // Don't detect session in URL on server
    },
  });
}

// Alias for backward compatibility
export async function createSupabaseClient() {
  return createServerSupabase();
}

// Context-aware createClient that works in both browser and server
export function createClientContextAware() {
  if (typeof window !== 'undefined') {
    return supabaseBrowser();
  }
  // For server-side, this will need to be awaited with cookies
  throw new Error('createClientContextAware cannot be used on server without cookies. Use createServerSupabase() instead.');
}

// Get authenticated user (server-side)
export async function getAuthenticatedUser() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const supabase = supabaseServer({
      get: (name) => cookieStore.get(name)?.value,
      set: () => {},
    });
    const { data: { session }, error } = await supabase.auth.getSession();
  const user = session?.user;
    
    if (error) {
      return { user: null, error: error.message };
    }
    
    return { user, error: null };
  } catch {
    return { user: null, error: 'Failed to get authenticated user' };
  }
}

// Get session (server-side)
export async function getSession() {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const supabase = supabaseServer({
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => {
        try {
          cookieStore.set(name, value, {
            ...options,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: false,
            path: '/',
          });
        } catch {
          // Silent error handling for cookie context
        }
      },
    });
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return { session: null, error: error.message };
    }
    
    return { session, error: null };
  } catch {
    return { session: null, error: 'Failed to get session' };
  }
}

// Export supabase instance for backward compatibility (getter to ensure singleton)
export const supabase = (() => supabaseBrowser())();

// Clear authentication storage (client-side only)
export function clearAuthStorage() {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Clear localStorage
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('sb-auth-token');
  
  // Clear sessionStorage
  sessionStorage.removeItem('supabase.auth.token');
  sessionStorage.removeItem('sb-auth-token');
  
  // Clear cookies
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
}

// Alias for backward compatibility
export const clearSupabaseAuth = clearAuthStorage;

