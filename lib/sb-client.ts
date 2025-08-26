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
  console.warn('[SUPABASE] Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
}

export const supabase = createBrowserClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

console.log('[AUTH DEBUG] Supabase client created successfully');

// OPTIONAL: small logger to spot state flips in dev
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((evt, sess) => {
    console.log('[AUTH DEBUG] Auth state change:', {
      event: evt,
      hasSession: !!sess,
      userId: sess?.user?.id,
      userEmail: sess?.user?.email
    });
  });
}
