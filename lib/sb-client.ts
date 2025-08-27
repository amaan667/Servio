'use client';
import { createBrowserClient } from '@supabase/ssr';

console.log('[AUTH DEBUG] ===== Supabase Client Initialization =====');
console.log('[AUTH DEBUG] Environment variables:', {
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
  timestamp: new Date().toISOString()
});

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      debug: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'servio-mvp',
      },
    },
  }
);

// Utility function to clear all authentication-related storage
export function clearAuthStorage() {
  try {
    console.log('[AUTH DEBUG] Clearing all authentication storage');
    
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
    );
    console.log('[AUTH DEBUG] Found localStorage keys to clear:', localStorageKeys);
    localStorageKeys.forEach(k => {
      const value = localStorage.getItem(k);
      console.log('[AUTH DEBUG] Removing localStorage key:', k, 'with value length:', value?.length);
      localStorage.removeItem(k);
    });
    
    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
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
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier")
    );
    console.log('[AUTH DEBUG] PKCE localStorage keys:', localStorageKeys);
    
    // Check sessionStorage for PKCE-related keys
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier")
    );
    console.log('[AUTH DEBUG] PKCE sessionStorage keys:', sessionStorageKeys);
    
    // Check for Supabase auth tokens
    const supabaseKeys = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
    console.log('[AUTH DEBUG] Supabase localStorage keys:', supabaseKeys);
    
    return {
      localStorageKeys,
      sessionStorageKeys,
      supabaseKeys,
      hasPKCE: localStorageKeys.length > 0 || sessionStorageKeys.length > 0,
      hasSupabaseAuth: supabaseKeys.length > 0
    };
  } catch (error) {
    console.log('[AUTH DEBUG] ❌ Error checking PKCE state:', error);
    return { error: error.message };
  }
}

// Utility function to check authentication state with retry
export async function checkAuthState() {
  try {
    const { data, error } = await supabase.auth.getSession();
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

// Enhanced logger to spot state flips in dev
if (typeof window !== 'undefined') {
  console.log('[AUTH DEBUG] Setting up auth state change listener');
  
  supabase.auth.onAuthStateChange((evt, sess) => {
    console.log('[AUTH DEBUG] 🔄 Auth state changed:', {
      event: evt,
      hasSession: !!sess,
      hasUser: !!sess?.user,
      userId: sess?.user?.id,
      userEmail: sess?.user?.email,
      sessionExpiresAt: sess?.expires_at,
      timestamp: new Date().toISOString()
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
  supabase.auth.getSession().then(({ data, error }) => {
    console.log('[AUTH DEBUG] Initial session check:', {
      hasSession: !!data.session,
      hasUser: !!data.session?.user,
      userId: data.session?.user?.id,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('[AUTH DEBUG] ===== Supabase Client Initialized =====');
}
