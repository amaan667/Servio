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

// Create single Supabase client instance with proper configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        if (typeof window !== 'undefined') {
          return window.localStorage.getItem(key);
        }
        return null;
      },
      setItem: (key, value) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
      },
      removeItem: (key) => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
      },
    },
    debug: process.env.NODE_ENV === 'development'
  }
});

export async function signInWithGoogle() {
  try {
    const redirectTo = getAuthRedirectUrl('/auth/callback');

    console.log('🔑 Starting Google OAuth...');
    console.log('📍 Redirect URL:', redirectTo);
    console.log('🌐 Current location:', typeof window !== 'undefined' ? window.location.href : 'server-side');
    
    logger.info('🔑 Initiating Google OAuth with redirect:', { redirectTo });

    // Try OAuth initiation
    console.log('🚀 Calling supabase.auth.signInWithOAuth...');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        },
        skipBrowserRedirect: false,
      },
    });

    console.log('📤 OAuth response:', { data, error });

    // If popup blocked, try redirect flow
    if (error?.message?.toLowerCase().includes('popup')) {
      logger.info('Popup blocked, falling back to redirect flow');
      
      const { data: redirectData, error: redirectError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          skipBrowserRedirect: false,
        },
      });

      if (redirectError) {
        logger.error('❌ Redirect OAuth failed:', redirectError);
        throw redirectError;
      }

      return redirectData;
    }

    if (error) {
      logger.error('❌ Google OAuth failed:', error);
      throw error;
    }

    logger.info('✅ Google OAuth initiated successfully');
    return data;
  } catch (error) {
    logger.error('❌ signInWithGoogle error:', { error });
    throw error;
  }
}

export async function signInUser(email: string, password: string) {
  try {
    logger.info("Attempting sign in", { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      logger.error("Sign in failed", { error });
      return {
        success: false,
        message: error?.message || "Failed to sign in"
      };
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

    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo,
      }
    });

    if (error) {
      if (error.message?.includes('identity_already_exists')) {
        return {
          success: false,
          message: 'This Google account is already linked to another user. Please sign in with that account instead.'
        };
      }
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    logger.error('Error linking Google account:', { error });
    return {
      success: false,
      message: 'Failed to link Google account. Please try again.'
    };
  }
}