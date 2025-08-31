import { createBrowserClient } from '@supabase/ssr'

let supabaseInstance: ReturnType<typeof createBrowserClient> | any | null = null;

function createMockClient() {
  // Minimal mock to satisfy build-time and non-configured environments
  return {
    auth: {
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
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env is missing or not in a browser, return a mock to avoid build-time crashes
  if (typeof window === 'undefined' || !url || !anon) {
    supabaseInstance = createMockClient();
    return supabaseInstance;
  }

  console.log('[AUTH DEBUG] === SUPABASE CLIENT CREATION ===');
  console.log('[AUTH DEBUG] Environment variables check:', {
    hasSupabaseUrl: !!url,
    hasAnonKey: !!anon,
    supabaseUrl: url?.substring(0, 20) + '...',
    anonKeyLength: anon?.length
  });

  supabaseInstance = createBrowserClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  console.log('[AUTH DEBUG] Supabase client created successfully (NO AUTO RESTORATION)');
  return supabaseInstance;
}

export const supabase = getOrCreateClient();

// Keep the old createClient function for backward compatibility
export function createClient() {
  if (typeof window !== 'undefined') {
    console.log('[AUTH DEBUG] createClient() called - returning existing supabase instance');
  }
  return getOrCreateClient();
}

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

export async function checkAuthState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const { data, error } = await supabase.auth.getSession();
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
