'use client';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[AUTH DEBUG] Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      url: supabaseUrl,
      key: supabaseAnonKey?.substring(0, 10) + '...'
    });
    
    // In production, this should never happen if Railway variables are set correctly
    throw new Error('Supabase configuration is missing. Please check your environment variables.');
  }

  const client = createBrowserClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // We handle this manually
        flowType: 'pkce',
        onAuthStateChange: (event, session) => {
          console.log('[AUTH DEBUG] Auth state change:', { event, hasSession: !!session });
        },
      },
      global: {
        headers: {
          'X-Client-Info': 'servio-web',
        },
      },
    }
  );

  // Add error handling for auth errors
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('[AUTH DEBUG] Token refreshed successfully');
    } else if (event === 'SIGNED_OUT') {
      console.log('[AUTH DEBUG] User signed out');
    }
  });

  return client;
}
