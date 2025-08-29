"use client";
import { createBrowserClient } from "@supabase/ssr";
import { Session, AuthChangeEvent, AuthError } from '@supabase/supabase-js';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Handle missing environment variables gracefully
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[SUPABASE] Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey
      });
      // Return a mock client for build time
      return {
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
          getUser: async () => ({ data: { user: null }, error: null }),
          signOut: async () => ({ error: null }),
          signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not configured') }),
          exchangeCodeForSession: async () => ({ data: null, error: new Error('Supabase not configured') }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          updateUser: async () => ({ data: null, error: new Error('Supabase not configured') })
        },
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
          update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
          delete: () => ({ eq: async () => ({ error: null }) })
        }),
        channel: () => ({
          on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
          removeChannel: () => {}
        }),
        removeChannel: () => {}
      } as any;
    }
    
    _client = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      { 
        isSingleton: true,
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        },
        // Disable cookie operations on client side to prevent Next.js 15 errors
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {}
        }
      }
    );
  }
  return _client;
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
    console.log('[AUTH DEBUG] Starting universal storage clear...');
    
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
      const value = localStorage.getItem(k);
      localStorage.removeItem(k);
      console.log(`[AUTH DEBUG] Cleared localStorage: ${k} = ${value ? 'had value' : 'was null'}`);
    });
    
    // Clear sessionStorage with comprehensive key detection
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("pkce") || 
      k.includes("verifier") ||
      k.includes("oauth") ||
      k.includes("auth")
    );
    
    sessionStorageKeys.forEach(k => {
      const value = sessionStorage.getItem(k);
      sessionStorage.removeItem(k);
      console.log(`[AUTH DEBUG] Cleared sessionStorage: ${k} = ${value ? 'had value' : 'was null'}`);
    });
    
    console.log('[AUTH DEBUG] Universal storage clear completed successfully');
  } catch (error) {
    console.error('[AUTH DEBUG] ❌ Error clearing storage:', error);
  }
}

// PKCE state checker function 
export function checkPKCEState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    const browserInfo = getBrowserInfo();
    console.log('[AUTH DEBUG] Checking PKCE state...');
    
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
    console.error('[AUTH DEBUG] ❌ Error checking PKCE state:', error);
    return { error: error.message };
  }
}

// Auth state checker function
export async function checkAuthState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    console.log('[AUTH DEBUG] Checking current auth state...');
    const browserInfo = getBrowserInfo();
    const { data, error } = await createClient().auth.getSession();
    console.log('[AUTH DEBUG] Current auth state:', {
      hasSession: !!data.session,
      hasUser: !!data.session?.user,
      userId: data.session?.user?.id,
      userEmail: data.session?.user?.email,
      sessionExpiresAt: data.session?.expires_at,
      error: error?.message,
      browserInfo
    });
    return { data, error };
  } catch (error) {
    console.log('[AUTH DEBUG] ❌ Error checking auth state:', error);
    return { data: null, error };
  }
}

// Enhanced PKCE state checker for debugging
export function debugPKCEState() {
  if (typeof window === 'undefined') return { isServer: true };
  
  try {
    console.log('[AUTH DEBUG] 🔍 Debugging PKCE state...');
    
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
    
    console.log('[AUTH DEBUG] 🔍 PKCE Debug Info:', debugInfo);
    return debugInfo;
  } catch (error) {
    console.error('[AUTH DEBUG] ❌ Error debugging PKCE state:', error);
    return { error: error.message };
  }
}
