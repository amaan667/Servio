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
          detectSessionInUrl: false,
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