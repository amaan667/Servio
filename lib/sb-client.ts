'use client';
import { createBrowserClient } from '@supabase/ssr';

// Check if environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
}

export const supabase = createBrowserClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'servio-web-app'
      }
    }
  }
);

// OPTIONAL: small logger to spot state flips in dev
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((evt, sess) => {
    console.log('[AUTH DEBUG] client', evt, { hasSession: !!sess, user: !!sess?.user });
  });
}

// Add error handling for network issues
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SUPABASE] Network connection restored');
  });
  
  window.addEventListener('offline', () => {
    console.log('[SUPABASE] Network connection lost');
  });
}
