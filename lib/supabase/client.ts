import { createBrowserClient } from '@supabase/ssr'

let supabaseInstance: ReturnType<typeof createBrowserClient> | any | null = null;

function createMockClient() {
  // Minimal mock to satisfy build-time and non-configured environments
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      signInWithOAuth: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      exchangeCodeForSession: async () => ({ data: { session: null }, error: { message: 'Supabase not configured' } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      delete: () => ({ eq: async () => ({ error: null }) })
    })
  } as any;
}

function getOrCreateClient() {
  // Don't cache - create fresh client each time to ensure env vars are loaded
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[SUPABASE CLIENT] Creating client:', {
    hasUrl: !!url,
    hasKey: !!anon,
    isBrowser: typeof window !== 'undefined',
    url: url ? `${url.substring(0, 20)}...` : 'missing',
    key: anon ? `${anon.substring(0, 10)}...` : 'missing'
  });

  // If env is missing or not in a browser, return a mock to avoid build-time crashes
  if (typeof window === 'undefined' || !url || !anon) {
    console.warn('[SUPABASE CLIENT] Missing environment variables or not in browser:', {
      hasUrl: !!url,
      hasKey: !!anon,
      isBrowser: typeof window !== 'undefined'
    });
    return createMockClient();
  }

  try {
    const client = createBrowserClient(url, anon, {
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
          'x-client-info': 'servio-dashboard',
        },
      },
    });
    
    console.log('[SUPABASE CLIENT] Client created successfully');
    return client;
  } catch (error) {
    console.error('[SUPABASE CLIENT] Error creating client:', error);
    // Fallback to mock if the browser client throws during initialization
    return createMockClient();
  }
}

// Keep the old createClient function for backward compatibility
export function createClient() {
  return getOrCreateClient();
}

// Export a lazy-initialized instance
export const supabase = getOrCreateClient();

// Backward compatibility functions for existing code
export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      (k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("auth")
    );
    localStorageKeys.forEach(k => localStorage.removeItem(k));
    
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("auth") && !k.includes("token-code-verifier")
    );
    sessionStorageKeys.forEach(k => sessionStorage.removeItem(k));
  } catch (error) {
    // Silent error handling
  }
}

export function checkPKCEState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const oauthProgress = sessionStorage.getItem("sb_oauth_in_progress");
    const pkceKeys = {
      supabaseVerifier: localStorage.getItem("supabase.auth.token-code-verifier"),
      authToken: localStorage.getItem("sb-auth-token"),
    };
    
    return {
      timestamp: new Date().toISOString(),
      oauthInProgress: oauthProgress === "true",
      pkceKeys,
      localStorage: {
        size: Object.keys(localStorage).length,
        authKeys: Object.keys(localStorage).filter(k => k.includes('auth') || k.includes('sb-')),
      },
      sessionStorage: {
        size: Object.keys(sessionStorage).length,
        authKeys: Object.keys(sessionStorage).filter(k => k.includes('auth') || k.includes('sb-')),
      }
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// SECURE: Use getUser() for authentication checks
export async function checkAuthState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const { data, error } = await supabase.auth.getUser();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export function debugPKCEState() {
  return checkPKCEState();
}

// Add missing getBrowserInfo function
export function getBrowserInfo() {
  if (typeof window === 'undefined') return { isServer: true };
  
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    timestamp: new Date().toISOString(),
  };
}
