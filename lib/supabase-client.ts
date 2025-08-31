'use client';

import { createBrowserClient } from '@supabase/ssr';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Handle missing environment variables gracefully
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[SUPABASE CLIENT] Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  });
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      // Disable cookie operations on client side to prevent Next.js 15 errors
      cookies: {
        get: () => undefined,
        set: () => {},
        remove: () => {}
      }
    })
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      },
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        delete: () => ({ eq: async () => ({ error: null }) })
      })
    } as any;

// Override the onAuthStateChange to prevent cookie operations
if (supabaseUrl && supabaseAnonKey) {
  const originalOnAuthStateChange = supabase.auth.onAuthStateChange;
  supabase.auth.onAuthStateChange = (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    return originalOnAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // Don't trigger any cookie operations during auth state changes
      console.log('[AUTH DEBUG] Auth state change (no cookie ops):', event, !!session);
      callback(event, session);
    });
  };
}

export async function signOut() {
  try {
    // Use server-side signout API instead of client-side auth.signOut()
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Server signout failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Get session error:', error);
    throw error;
  }
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Get user error:', error);
    throw error;
  }
  return user;
}
