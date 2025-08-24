'use client';

import { createBrowserClient } from '@supabase/ssr';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a null client if environment variables are missing
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseClient = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storageKey: 'servio-auth-token',
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          onAuthStateChange: (event, session) => {
            console.log('[AUTH DEBUG] client:onAuthStateChange', { event, hasSession: !!session });
            
            // Handle refresh token errors
            if (event === 'TOKEN_REFRESHED' && !session) {
              console.log('[AUTH DEBUG] client:token-refresh-failed, clearing session');
              // Clear any invalid session data
              localStorage.removeItem('supabase.auth.token');
              sessionStorage.removeItem('supabase.auth.token');
              localStorage.removeItem('servio-auth-token');
            }
          },
        },
        global: {
          headers: {
            'X-Client-Info': 'servio-web',
          },
        },
      }
    );
    console.log('[SUPABASE-CLIENT] ✅ Client initialized successfully');
  } catch (error) {
    console.error('[SUPABASE-CLIENT] ❌ Failed to initialize client:', error);
    supabaseClient = null;
  }
} else {
  console.error('[SUPABASE-CLIENT] ❌ Missing environment variables - client not initialized');
  console.error('[SUPABASE-CLIENT] URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.error('[SUPABASE-CLIENT] KEY:', supabaseAnonKey ? 'SET' : 'MISSING');
}

// Export a wrapper that handles the null case
export const supabase = supabaseClient;

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseClient !== null;
};

// Helper function to clear invalid sessions
export const clearInvalidSession = async () => {
  if (!supabaseClient) return;
  
  try {
    // Clear any stored session data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('servio-auth-token');
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
    }
    
    // Sign out to clear any server-side session
    await supabaseClient.auth.signOut();
    
    // Also call the API route to clear server-side session
    try {
      await fetch('/api/auth/clear-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (apiError) {
      console.warn('[SUPABASE-CLIENT] API session clear failed (non-fatal):', apiError);
    }
    
    console.log('[SUPABASE-CLIENT] Cleared invalid session');
  } catch (error) {
    console.error('[SUPABASE-CLIENT] Error clearing session:', error);
  }
};