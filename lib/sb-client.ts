'use client';
import { createBrowserClient } from '@supabase/ssr';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    // Provide fallback values for build time
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
    
    // Enhanced mobile detection
    const isMobile = typeof window !== 'undefined' && isMobileDevice();
    const browserInfo = typeof window !== 'undefined' ? getBrowserInfo() : { type: 'unknown', isMobile: false };
    
    console.log('[AUTH DEBUG] Creating Supabase client with config:', {
      isMobile,
      browserInfo,
      timestamp: new Date().toISOString()
    });
    
    _client = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      { 
        isSingleton: true,
        auth: {
          // Enhanced auth configuration for better mobile support
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          // Enhanced cookie options for mobile browsers
          cookieOptions: {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            // Add domain for better mobile support
            domain: typeof window !== 'undefined' ? window.location.hostname : undefined,
          },
          // Enhanced storage configuration for mobile browsers
          storage: {
            getItem: (key: string) => {
              try {
                // Try localStorage first
                const value = localStorage.getItem(key);
                if (value !== null) return value;
                
                // Fallback to sessionStorage for mobile browsers
                return sessionStorage.getItem(key);
              } catch (error) {
                console.log('[AUTH DEBUG] Storage getItem error:', error);
                return null;
              }
            },
            setItem: (key: string, value: string) => {
              try {
                // Store in both localStorage and sessionStorage for mobile reliability
                localStorage.setItem(key, value);
                sessionStorage.setItem(key, value);
              } catch (error) {
                console.log('[AUTH DEBUG] Storage setItem error:', error);
                // Fallback to sessionStorage only
                try {
                  sessionStorage.setItem(key, value);
                } catch (fallbackError) {
                  console.log('[AUTH DEBUG] SessionStorage fallback error:', fallbackError);
                }
              }
            },
            removeItem: (key: string) => {
              try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
              } catch (error) {
                console.log('[AUTH DEBUG] Storage removeItem error:', error);
              }
            }
          }
        }
      }
    );
  }
  return _client;
}

// Utility function to clear all authentication-related storage
export function clearAuthStorage() {
  try {
    console.log('[AUTH DEBUG] Clearing all authentication storage');
    
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth") || k.includes("code_verifier")
    );
    console.log('[AUTH DEBUG] Found localStorage keys to clear:', localStorageKeys);
    localStorageKeys.forEach(k => {
      const value = localStorage.getItem(k);
      console.log('[AUTH DEBUG] Removing localStorage key:', k, 'with value length:', value?.length);
      localStorage.removeItem(k);
    });
    
    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth") || k.includes("code_verifier")
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

// Utility function to check PKCE state
export function checkPKCEState() {
  try {
    console.log('[AUTH DEBUG] Checking PKCE state...');
    
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
      oauthStartTime: oauthStartTime ? new Date(parseInt(oauthStartTime)).toISOString() : null
    };
  } catch (error: any) {
    console.log('[AUTH DEBUG] ❌ Error checking PKCE state:', error);
    return { error: error.message };
  }
}

// Utility function to check authentication state with retry
export async function checkAuthState() {
  try {
    const { data, error } = await createClient().auth.getSession();
    console.log('[AUTH DEBUG] Current auth state:', {
      hasSession: !!data.session,
      hasUser: !!data.session?.user,
      userId: data.session?.user?.id,
      userEmail: data.session?.user?.email,
      sessionExpiresAt: data.session?.expires_at,
      error: error?.message
    });
    return { data, error };
  } catch (error) {
    console.log('[AUTH DEBUG] ❌ Error checking auth state:', error);
    return { data: null, error };
  }
}

// Utility function to check if we're on a mobile device
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
  
  return mobileKeywords.some(keyword => userAgent.includes(keyword));
}

// Utility function to check browser type
export function getBrowserInfo() {
  if (typeof window === 'undefined') return { type: 'unknown', isMobile: false };
  
  const userAgent = window.navigator.userAgent;
  const isMobile = isMobileDevice();
  
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

// Enhanced logger to spot state flips in dev
if (typeof window !== 'undefined') {
  console.log('[AUTH DEBUG] Setting up auth state change listener');
  console.log('[AUTH DEBUG] Browser info:', getBrowserInfo());

  createClient().auth.onAuthStateChange((evt, sess) => {
    console.log('[AUTH DEBUG] 🔄 Auth state changed:', {
      event: evt,
      hasSession: !!sess,
      hasUser: !!sess?.user,
      userId: sess?.user?.id,
      userEmail: sess?.user?.email,
      sessionExpiresAt: sess?.expires_at,
      timestamp: new Date().toISOString(),
      browserInfo: getBrowserInfo()
    });
    
    // Additional logging for specific events
    if (evt === 'SIGNED_IN') {
      console.log('[AUTH DEBUG] ✅ User signed in successfully');
    } else if (evt === 'SIGNED_OUT') {
      console.log('[AUTH DEBUG] 🚪 User signed out');
    } else if (evt === 'TOKEN_REFRESHED') {
      console.log('[AUTH DEBUG] 🔄 Token refreshed');
    } else if (evt === 'USER_UPDATED') {
      console.log('[AUTH DEBUG] 👤 User data updated');
    }
  });
  
  // Log initial session state
  createClient().auth.getSession().then(({ data, error }) => {
    console.log('[AUTH DEBUG] Initial session check:', {
      hasSession: !!data.session,
      hasUser: !!data.session?.user,
      userId: data.session?.user?.id,
      error: error?.message,
      timestamp: new Date().toISOString(),
      browserInfo: getBrowserInfo()
    });
  });
  
  console.log('[AUTH DEBUG] ===== Supabase Client Initialized =====');
}
