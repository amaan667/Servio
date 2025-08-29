import { createBrowserClient } from '@supabase/ssr'

// Handle missing environment variables during build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a mock client for build time if environment variables are missing
const createMockClient = () => ({
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not configured') }),
    signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
    signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
    updateUser: async () => ({ data: null, error: new Error('Supabase not configured') })
  },
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
    update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    delete: () => ({ eq: async () => ({ error: null }) })
  })
});

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createMockClient() as any;

// Keep the old createClient function for backward compatibility
export function createClient() {
  return supabase;
}

// Browser info for debugging
export function getBrowserInfo() {
  if (typeof window === 'undefined') return { isServer: true };
  
  const userAgent = window.navigator.userAgent;
  const platform = navigator.platform || 'unknown';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  const isChrome = /Chrome/.test(userAgent);
  const isFirefox = /Firefox/.test(userAgent);
  
  return {
    userAgent,
    platform,
    isMobile,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    isServer: false,
  };
}

// Universal storage clearing function for all platforms
export function clearAuthStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear localStorage with comprehensive key detection
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.startsWith("sb-") || 
      k.includes("pkce") || 
      k.includes("token-code-verifier") || 
      k.includes("code_verifier") ||
      k.includes("auth") ||
      k.includes("verifier")
    );
    
    localStorageKeys.forEach(k => {
      localStorage.removeItem(k);
    });
    
    // Clear sessionStorage with comprehensive key detection
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("pkce") || 
      k.includes("verifier") ||
      k.includes("oauth") ||
      k.includes("auth")
    );
    
    sessionStorageKeys.forEach(k => {
      sessionStorage.removeItem(k);
    });
  } catch (error) {
    // Silent error handling
  }
}

// PKCE state checker function 
export function checkPKCEState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const browserInfo = getBrowserInfo();
    
    // Check OAuth progress flags
    const oauthProgress = sessionStorage.getItem("sb_oauth_in_progress");
    const oauthStartTime = sessionStorage.getItem("sb_oauth_start_time");
    
    // Check various PKCE verifier keys in different locations
    const pkceKeys = {
      supabaseVerifier: localStorage.getItem("supabase.auth.token-code-verifier"),
      customVerifier: sessionStorage.getItem("pkce_verifier"),
      authToken: localStorage.getItem("sb-auth-token"),
    };
    
    return {
      timestamp: new Date().toISOString(),
      oauthInProgress: oauthProgress === "true",
      oauthStartTime: oauthStartTime ? parseInt(oauthStartTime) : null,
      pkceKeys,
      browserInfo,
      localStorage: {
        size: Object.keys(localStorage).length,
        authKeys: Object.keys(localStorage).filter(k => k.includes('auth') || k.includes('sb-') || k.includes('pkce')),
      },
      sessionStorage: {
        size: Object.keys(sessionStorage).length,
        authKeys: Object.keys(sessionStorage).filter(k => k.includes('auth') || k.includes('sb-') || k.includes('pkce')),
      }
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Auth state checker function
export async function checkAuthState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const browserInfo = getBrowserInfo();
    const { data, error } = await createClient().auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

// Enhanced PKCE state checker for debugging
export function debugPKCEState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const browserInfo = getBrowserInfo();
    const oauthProgress = sessionStorage.getItem("sb_oauth_in_progress");
    const oauthStartTime = sessionStorage.getItem("sb_oauth_start_time");
    
    // Check all possible PKCE verifier locations
    const pkceKeys = {
      supabaseVerifier: localStorage.getItem("supabase.auth.token-code-verifier"),
      customVerifier: sessionStorage.getItem("pkce_verifier"),
      authToken: localStorage.getItem("sb-auth-token"),
      // Check for any other potential verifier keys
      allLocalStorage: Object.keys(localStorage).filter(k => 
        k.includes('verifier') || k.includes('pkce') || k.includes('code')
      ),
      allSessionStorage: Object.keys(sessionStorage).filter(k => 
        k.includes('verifier') || k.includes('pkce') || k.includes('code')
      )
    };
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      oauthInProgress: oauthProgress === "true",
      oauthStartTime: oauthStartTime ? parseInt(oauthStartTime) : null,
      pkceKeys,
      browserInfo,
      localStorage: {
        size: Object.keys(localStorage).length,
        authKeys: Object.keys(localStorage).filter(k => k.includes('auth') || k.includes('sb-') || k.includes('pkce')),
      },
      sessionStorage: {
        size: Object.keys(sessionStorage).length,
        authKeys: Object.keys(sessionStorage).filter(k => k.includes('auth') || k.includes('sb-') || k.includes('pkce')),
      }
    };
    
    return debugInfo;
  } catch (error) {
    return { error: error.message };
  }
}
