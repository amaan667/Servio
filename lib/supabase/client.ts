"use client";
import { createBrowserClient } from "@supabase/ssr";
import { Session, AuthChangeEvent, AuthError } from '@supabase/supabase-js';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { 
        isSingleton: true,
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
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
