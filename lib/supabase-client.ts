'use client';

import { createBrowserClient } from '@supabase/ssr';

console.log('[AUTH DEBUG] ===== SUPABASE CLIENT INITIALIZATION =====');
console.log('[AUTH DEBUG] Timestamp:', new Date().toISOString());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('[AUTH DEBUG] Environment Variables:');
console.log('[AUTH DEBUG] - NEXT_PUBLIC_SUPABASE_URL exists:', !!supabaseUrl);
console.log('[AUTH DEBUG] - NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!supabaseAnonKey);
console.log('[AUTH DEBUG] - Supabase URL preview:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET');
console.log('[AUTH DEBUG] - Supabase Key preview:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'NOT SET');

console.log('[AUTH DEBUG] 🔄 Creating Supabase browser client...');
const clientStartTime = Date.now();

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

const clientTime = Date.now() - clientStartTime;
console.log(`[AUTH DEBUG] ⏱️ Supabase client created in ${clientTime}ms`);
console.log('[AUTH DEBUG] - Client object exists:', !!supabase);
console.log('[AUTH DEBUG] - Client.auth exists:', !!(supabase && supabase.auth));
console.log('[AUTH DEBUG] ✅ Supabase client initialization completed');

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
  
  return data;
}

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
