'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { AuthChangeEvent, Session, AuthError } from '@supabase/supabase-js';

let _client: ReturnType<typeof createBrowserClient> | null = null;

// Universal browser detection for logging only
export function getBrowserInfo() {
  if (typeof window === 'undefined') return { type: 'unknown', isMobile: false };
  
  const userAgent = window.navigator.userAgent;
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent.toLowerCase());
  
  let browserType = 'unknown';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserType = 'safari';
  } else if (userAgent.includes('Chrome')) {
    browserType = 'chrome';
  } else if (userAgent.includes('Firefox')) {
    browserType = 'firefox';
  } else if (userAgent.includes('Edge')) {
    browserType = 'edge';
  }
  
  return { type: browserType, isMobile, userAgent };
}

export function createClient() {
  if (!_client) {
    // Check for required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[AUTH DEBUG] Missing required environment variables:', {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseAnonKey: !!supabaseAnonKey,
        supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
        supabaseAnonKey: supabaseAnonKey ? 'SET' : 'MISSING'
      });
      
      // Return a mock client that won't crash the app
      return {
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
          signInWithOAuth: async () => ({ data: null, error: { message: 'Environment variables not configured' } }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
        }
      } as any;
    }
    
    const browserInfo = getBrowserInfo();
    
    _client = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      { 
        isSingleton: true,
        auth: {
          autoRefreshToken: true, // Enable auto refresh for proper session management
          persistSession: true, // Enable session persistence for auth state
          detectSessionInUrl: true, // Enable session detection in URL for OAuth
          flowType: 'pkce',
          // Mobile-optimized settings
          debug: false,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined
        }
      }
    );
    
  }
  return _client;
}

// Universal utility function to clear all authentication-related storage
export function clearAuthStorage() {
  try {
    const browserInfo = getBrowserInfo();
    
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      (k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("auth") || k.includes("code_verifier")
    );
    localStorageKeys.forEach(k => {
      const value = localStorage.getItem(k);
      localStorage.removeItem(k);
    });
    
    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      (k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("auth") || k.includes("code_verifier")
    );
    sessionStorageKeys.forEach(k => {
      const value = sessionStorage.getItem(k);
      sessionStorage.removeItem(k);
    });
    
    return true;
  } catch (error) {
    return false;
  }
}

// Universal utility function to check PKCE state
export function checkPKCEState() {
  try {
    const browserInfo = getBrowserInfo();
    
    // Check localStorage for PKCE-related keys
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
    );
    
    // Check sessionStorage for PKCE-related keys
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
    );
    
    // Check for Supabase auth tokens
    const supabaseKeys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
    
    // Check for OAuth progress flags
    const oauthProgress = sessionStorage.getItem("sb_oauth_in_progress");
    const oauthStartTime = sessionStorage.getItem("sb_oauth_start_time");
    
    return {
      localStorageKeys,
      sessionStorageKeys,
      supabaseKeys,
      hasPKCE: localStorageKeys.length > 0 || sessionStorageKeys.length > 0,
      hasSupabaseAuth: supabaseKeys.length > 0,
      oauthProgress: !!oauthProgress,
      oauthStartTime: oauthStartTime ? new Date(parseInt(oauthStartTime)).toISOString() : null,
      browserInfo
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Universal utility function to check authentication state
export async function checkAuthState() {
  try {
    const browserInfo = getBrowserInfo();
    const { data, error } = await createClient().auth.getSession();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

// Universal logger for auth state changes
if (typeof window !== 'undefined') {
  const client = createClient();
  
  // Override console.error to filter out refresh token errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('Invalid Refresh Token') || 
        message.includes('Refresh Token Not Found') ||
        message.includes('AuthApiError')) {
      // Don't log refresh token errors to console
      return;
    }
    originalConsoleError.apply(console, args);
  };
  
  // Override the onAuthStateChange to prevent cookie operations
  const originalOnAuthStateChange = client.auth.onAuthStateChange;
  client.auth.onAuthStateChange = (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    return originalOnAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // Don't trigger any cookie operations during auth state changes
      callback(event, session);
    });
  };
}
