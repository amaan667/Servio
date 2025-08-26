'use client';
import { createBrowserClient } from '@supabase/ssr';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('[AUTH DEBUG] Supabase client configuration:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey?.substring(0, 20) + '...',
  environment: process.env.NODE_ENV
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[AUTH DEBUG] Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
  
  throw new Error('Supabase configuration is missing. Please check your environment variables.');
}

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // We handle this manually in callback
      flowType: 'pkce',
      onAuthStateChange: (event, session) => {
        console.log('[AUTH DEBUG] Auth state change:', { 
          event, 
          hasSession: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email
        });
      },
    },
    global: {
      headers: {
        'X-Client-Info': 'servio-web',
      },
      fetch: (url, options = {}) => {
        // Add timeout to all fetch requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    },
  }
);

console.log('[AUTH DEBUG] Supabase client created successfully');
