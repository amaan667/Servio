'use client';

import { createBrowserClient } from '@supabase/ssr';
import { AuthChangeEvent, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  // Disable cookie operations on client side to prevent Next.js 15 errors
  cookies: {
    get: () => undefined,
    set: () => {},
    remove: () => {}
  }
});

// Override the onAuthStateChange to prevent cookie operations
const originalOnAuthStateChange = supabase.auth.onAuthStateChange;
supabase.auth.onAuthStateChange = (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
  return originalOnAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
    // Don't trigger any cookie operations during auth state changes
    console.log('[AUTH DEBUG] Auth state change (no cookie ops):', event, !!session);
    callback(event, session);
  });
};

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
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
