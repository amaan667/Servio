import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';
import { getAuthRedirectUrl } from './auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables:", {
    NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey
  });
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // force PKCE for OAuth
    storage: {
      getItem: (key) => (typeof window !== 'undefined' ? window.localStorage.getItem(key) : null),
      setItem: (key, value) => (typeof window !== 'undefined' ? window.localStorage.setItem(key, value) : undefined),
      removeItem: (key) => (typeof window !== 'undefined' ? window.localStorage.removeItem(key) : undefined),
    },
    debug: process.env.NODE_ENV === 'development',
  },
});

export async function signInWithGoogle() {
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
  console.log('[AUTH] start →', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
    flowType: 'pkce',
  });

  if (error) {
    console.error('[AUTH] start error:', error);
    alert(`Sign-in error: ${error.message}`);
    return;
  }

  // Some environments don't auto-redirect. Force it:
  const url = data?.url;
  console.log('[AUTH] provider URL:', url);
  if (url) window.location.href = url;
}

export async function signInUser(email: string, password: string) {
  try {
    logger.info("Attempting sign in", { email });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      logger.error("Sign in failed", { error });
      return { success: false, message: error?.message || "Failed to sign in" };
    }
    return { success: true, user: data.user };
  } catch (error: any) {
    logger.error("Sign in error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function linkGoogleAccount() {
  try {
    const redirectTo = getAuthRedirectUrl('/settings/account');
    const { data, error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo } });
    if (error) {
      if (error.message?.includes('identity_already_exists')) {
        return { success: false, message: 'This Google account is already linked to another user. Please sign in with that account instead.' };
      }
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    logger.error('Error linking Google account', { error });
    return { success: false, message: 'Failed to link Google account. Please try again.' };
  }
}