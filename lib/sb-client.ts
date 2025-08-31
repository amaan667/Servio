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
          autoRefreshToken: false, // Disable auto refresh to prevent auto sign-in
          persistSession: false, // Disable session persistence to prevent auto sign-in
          detectSessionInUrl: false, // Disable session detection in URL
          flowType: 'pkce'
        },
        // Completely disable cookie operations on client side to prevent Next.js 15 errors
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {}
        }
      }
    );
    
    console.log('[AUTH DEBUG] Supabase client created with NO automatic session restoration and NO cookie operations:', browserInfo);
  }
  return _client;
}

// Universal utility function to clear all authentication-related storage
export function clearAuthStorage() {
  try {
    const browserInfo = getBrowserInfo();
    console.log('[AUTH DEBUG] Clearing all authentication storage', { browserInfo });
    
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      (k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("auth") || k.includes("code_verifier")
    );
    console.log('[AUTH DEBUG] Found localStorage keys to clear:', localStorageKeys);
    localStorageKeys.forEach(k => {
      const value = localStorage.getItem(k);
      console.log('[AUTH DEBUG] Removing localStorage key:', k, 'with value length:', value?.length);
      localStorage.removeItem(k);
    });
    
    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      (k.startsWith("sb-") && !k.includes("token-code-verifier")) || k.includes("auth") || k.includes("code_verifier")
    );
    console.log('[AUTH DEBUG] Found sessionStorage keys to clear:', sessionStorageKeys);
    sessionStorageKeys.forEach(k => {
      const value = sessionStorage.getItem(k);
      console.log('[AUTH DEBUG] Removing sessionStorage key:', k, 'with value length:', value?.length);
      sessionStorage.removeItem(k);
    });
    
    console.log('[AUTH DEBUG] ✅ Authentication storage cleared successfully');
    return true;
  } catch (error) {
    console.log('[AUTH DEBUG] ❌ Failed to clear authentication storage:', error);
    return false;
  }
}

// Universal utility function to check PKCE state
export function checkPKCEState() {
  try {
    const browserInfo = getBrowserInfo();
    console.log('[AUTH DEBUG] Checking PKCE state...', { browserInfo });
    
    // Check localStorage for PKCE-related keys
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
    );
    console.log('[AUTH DEBUG] PKCE localStorage keys:', localStorageKeys);
    
    // Check sessionStorage for PKCE-related keys
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
    );
    console.log('[AUTH DEBUG] PKCE sessionStorage keys:', sessionStorageKeys);
    
    // Check for Supabase auth tokens
    const supabaseKeys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
    console.log('[AUTH DEBUG] Supabase localStorage keys:', supabaseKeys);
    
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
    console.log('[AUTH DEBUG] ❌ Error checking PKCE state:', error);
    return { error: error.message };
  }
}

// Universal utility function to check authentication state
export async function checkAuthState() {
  try {
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

// Universal logger for auth state changes
if (typeof window !== 'undefined') {
  const browserInfo = getBrowserInfo();
  console.log('[AUTH DEBUG] Setting up universal auth state change listener');
  console.log('[AUTH DEBUG] Browser info:', browserInfo);

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
      console.log('[AUTH DEBUG] Auth state change (no cookie ops):', event, !!session);
      callback(event, session);
    });
  };
  
  // Log initial session state
  client.auth.getSession().then(({ data, error }: { data: { session: Session | null }, error: AuthError | null }) => {
    console.log('[AUTH DEBUG] Initial session check:', {
      hasSession: !!data.session,
      hasUser: !!data.session?.user,
      userId: data.session?.user?.id,
      error: error?.message,
      timestamp: new Date().toISOString(),
      browserInfo
    });
    
    // If there's an error with the initial session, clear storage
    if (error && (error.message?.includes('Refresh Token') || 
                  error.message?.includes('Invalid') || 
                  error.message?.includes('400') ||
                  error.status === 400)) {
      console.log('[AUTH DEBUG] Clearing invalid initial session due to error:', error.message);
      clearAuthStorage();
    }
  });
  
  console.log('[AUTH DEBUG] ===== Universal Supabase Client Initialized (NO AUTO RESTORATION) =====');
}
