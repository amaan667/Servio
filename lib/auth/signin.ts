"use client";
import { createClient } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";
import { authLogger as logger } from '@/lib/logger';

export async function signInWithGoogle() {
  
  const sb = createClient();

  try {
    
    // Save the current PKCE verifier value if it exists
    const pkceVerifier = localStorage.getItem('supabase.auth.token-code-verifier');
    if (pkceVerifier) {
      // Temporarily store it
      sessionStorage.setItem('_temp_pkce_verifier', pkceVerifier);
    } else {
    }
    
    // Clear all Supabase-related localStorage EXCEPT code verifier
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") && !k.includes("token-code-verifier")) {
        localStorage.removeItem(k);
      }
    });
    
    // Restore the PKCE verifier if we saved it
    if (pkceVerifier) {
      localStorage.setItem('supabase.auth.token-code-verifier', pkceVerifier);
    }
    
    // Clear OAuth progress flags from previous attempts
    sessionStorage.removeItem("sb_oauth_retry");
    sessionStorage.removeItem("sb_oauth_in_progress");
  } catch (error) {
    // Silent error handling
  }

  const redirectTo = getAuthRedirectUrl('/auth/callback');

  logger.debug('[AUTH] Environment check:', {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    origin: window.location.origin
  });

  logger.debug('[AUTH] Supabase config check:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  // Test Supabase connection before OAuth
  try {
    const { data: testData, error: testError } = await sb.auth.getSession();
    logger.debug('[AUTH] Session test:', {
      hasTestData: !!testData,
      hasTestError: !!testError,
      testErrorMessage: testError?.message
    });
  } catch (testErr) {
    logger.debug('[AUTH] Session test error:', testErr);
  }

  
  // Clear any existing OAuth state before starting
  try {
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());
  } catch (e) {
    logger.debug('[AUTH] Session storage error:', e);
  }
  
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo,
      queryParams: { 
        prompt: 'select_account',
        access_type: 'offline'
      }
    },
  });

  logger.debug('[AUTH] OAuth result:', {
    hasData: !!data,
    hasError: !!error,
    errorMessage: error?.message,
    errorStatus: error?.status,
    hasUrl: !!data?.url,
    urlLength: data?.url?.length
  });

  if (error) {
    logger.error('[AUTH DEBUG] OAuth error details:', {
      message: error.message,
      status: error.status,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }

  
  // Check for OAuth state in storage after initiation
  const oauthKeys: string[] = Object.keys(localStorage).filter(k => 
    k.includes('auth') || k.includes('sb-') || k.includes('pkce')
  );
  
  // Automatically redirect to OAuth URL
  if (data?.url) {
    
    // Redirect immediately - no artificial delay
    window.location.href = data.url;
  } else {
    logger.error('[AUTH DEBUG] No OAuth URL received from Supabase');
    logger.error('[AUTH DEBUG] Full OAuth response data:', data);
    throw new Error('No OAuth URL received');
  }

  return data;
}
