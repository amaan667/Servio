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
    },
  }
);

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
