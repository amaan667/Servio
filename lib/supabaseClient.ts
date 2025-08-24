'use client';

import { createBrowserClient } from '@supabase/ssr';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a null client if environment variables are missing
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        onAuthStateChange: (event, session) => {
          console.log('[AUTH DEBUG] client:onAuthStateChange', { event, hasSession: !!session });
          
          // Handle refresh token errors
          if (event === 'TOKEN_REFRESHED' && !session) {
            console.log('[AUTH DEBUG] client:token-refresh-failed, clearing session');
            // Clear any invalid session data
            localStorage.removeItem('supabase.auth.token');
            sessionStorage.removeItem('supabase.auth.token');
          }
        },
      },
    }
  );
} else {
  console.warn('[SUPABASE-CLIENT] Missing environment variables - client not initialized');
}

// Export a wrapper that handles the null case
export const supabase = supabaseClient;

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseClient !== null;
};