/**
 * Unified Supabase Client Factory
 * Single source of truth for all Supabase client creation
 * Eliminates duplication across client.ts, server.ts, and browser.ts
 */

import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

type ClientContext = 'browser' | 'server' | 'admin';

interface ClientConfig {
  url: string;
  key: string;
  context: ClientContext;
}

/**
 * Get environment variables with validation
 */
function getSupabaseConfig(): { url: string; anonKey: string; serviceKey?: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return { url, anonKey, serviceKey };
}

/**
 * Create a mock client for build-time safety
 */
function createMockClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithOAuth: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: { message: 'Supabase not configured' } }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({ 
        eq: () => ({ 
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
        }) 
      }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ select: async () => ({ data: null, error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) })
    })
  } as any;
}

/**
 * Unified client factory
 * Creates the appropriate Supabase client based on context
 */
export async function createSupabaseClient(context: ClientContext = 'server') {
  // Browser context
  if (context === 'browser') {
    if (typeof window === 'undefined') {
      return createMockClient();
    }

    const { url, anonKey } = getSupabaseConfig();
    
    return createBrowserClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          'x-client-info': 'servio-web-app',
        },
      },
    });
  }

  // Admin context (uses service role key)
  if (context === 'admin') {
    const { url, serviceKey } = getSupabaseConfig();
    
    if (!serviceKey) {
      throw new Error('Service role key required for admin context');
    }

    return createServerClient(url, serviceKey, {
      cookies: {
        get: () => undefined,
        set: () => {},
        remove: () => {},
      },
    });
  }

  // Server context (default)
  const { url, anonKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    cookies: {
      get(name: string) {
        try {
          return cookieStore.get(name)?.value;
        } catch (error) {
          return undefined;
        }
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, {
            ...options,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: false,
            path: '/',
          });
        } catch (error) {
          // Silently fail for cookie context errors
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set(name, '', {
            ...options,
            maxAge: 0,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: false,
            path: '/',
          });
        } catch (error) {
          // Silently fail for cookie context errors
        }
      },
    },
  });
}

/**
 * Get authenticated user (server-side)
 */
export async function getAuthenticatedUser() {
  try {
    const supabase = await createSupabaseClient('server');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return { user: null, error: error.message };
    }
    
    return { user, error: null };
  } catch (error) {
    return { user: null, error: 'Failed to get authenticated user' };
  }
}

/**
 * Get session (server-side)
 */
export async function getSession() {
  try {
    const supabase = await createSupabaseClient('server');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      return { session: null, error: error.message };
    }
    
    return { session, error: null };
  } catch (error) {
    return { session: null, error: 'Failed to get session' };
  }
}

/**
 * Clear auth storage (browser-side)
 */
export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    const localStorageKeys = Object.keys(localStorage).filter(
      k => (k.startsWith('sb-') && !k.includes('token-code-verifier')) || k.includes('auth')
    );
    localStorageKeys.forEach(k => localStorage.removeItem(k));
    
    const sessionStorageKeys = Object.keys(sessionStorage).filter(
      k => k.includes('auth') && !k.includes('token-code-verifier')
    );
    sessionStorageKeys.forEach(k => sessionStorage.removeItem(k));
  } catch (error) {
    // Silent error handling
  }
}

/**
 * Browser-specific client (for backward compatibility)
 */
export const supabaseBrowser = () => {
  if (typeof window === 'undefined') {
    throw new Error('supabaseBrowser can only be used in the browser');
  }
  return createSupabaseClient('browser');
};

/**
 * Backward compatibility exports
 */
export const createClient = createSupabaseClient;
export const createAdminClient = () => createSupabaseClient('admin');
export const createServerSupabase = () => createSupabaseClient('server');

