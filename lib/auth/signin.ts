"use client";
import { createClient } from "@/lib/supabase/client";

export async function signInWithGoogle() {
  console.log('[AUTH DEBUG] === GOOGLE SIGN-IN START ===');
  console.log('[AUTH DEBUG] Step 1: Creating Supabase client');
  
  const sb = createClient();

  try {
    console.log('[AUTH DEBUG] Step 2: Preserving PKCE state and clearing stale OAuth state');
    
    // Save the current PKCE verifier value if it exists
    const pkceVerifier = localStorage.getItem('supabase.auth.token-code-verifier');
    if (pkceVerifier) {
      console.log('[AUTH DEBUG] Found existing PKCE verifier, length:', pkceVerifier.length);
      // Temporarily store it
      sessionStorage.setItem('_temp_pkce_verifier', pkceVerifier);
    } else {
      console.log('[AUTH DEBUG] No existing PKCE verifier found');
    }
    
    // Clear all Supabase-related localStorage EXCEPT code verifier
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") && !k.includes("token-code-verifier")) {
        console.log('[AUTH DEBUG] Clearing localStorage key:', k);
        localStorage.removeItem(k);
      }
    });
    
    // Restore the PKCE verifier if we saved it
    if (pkceVerifier) {
      localStorage.setItem('supabase.auth.token-code-verifier', pkceVerifier);
      console.log('[AUTH DEBUG] Restored PKCE verifier after clearing');
    }
    
    // Clear OAuth progress flags from previous attempts
    sessionStorage.removeItem("sb_oauth_retry");
    sessionStorage.removeItem("sb_oauth_in_progress");
    console.log('[AUTH DEBUG] OAuth state cleared successfully (preserved PKCE verifier)');
  } catch (error) {
    console.log('[AUTH DEBUG] Error clearing OAuth state:', error);
    // Silent error handling
  }

  const redirectTo = process.env.NODE_ENV === 'production' 
    ? 'https://servio-production.up.railway.app/auth/callback'
    : `${window.location.origin}/auth/callback`;

  console.log('[AUTH DEBUG] Step 3: OAuth configuration');
  console.log('[AUTH DEBUG] Redirect URL:', redirectTo);
  console.log('[AUTH DEBUG] Environment variables:', {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    origin: window.location.origin
  });

  console.log('[AUTH DEBUG] Step 4: Initiating OAuth with Supabase');
  console.log('[AUTH DEBUG] Supabase client config:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  // Test Supabase connection before OAuth
  console.log('[AUTH DEBUG] Step 4a: Testing Supabase connection');
  try {
    const { data: testData, error: testError } = await sb.auth.getSession();
    console.log('[AUTH DEBUG] Connection test result:', {
      hasTestData: !!testData,
      hasTestError: !!testError,
      testErrorMessage: testError?.message
    });
  } catch (testErr) {
    console.log('[AUTH DEBUG] Connection test failed:', testErr);
  }

  console.log('[AUTH DEBUG] Step 4b: Calling signInWithOAuth');
  
  // Clear any existing OAuth state before starting
  try {
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());
  } catch (e) {
    console.log('[AUTH DEBUG] Could not set OAuth progress flags:', e);
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

  console.log('[AUTH DEBUG] Step 5: OAuth initiation result');
  console.log('[AUTH DEBUG] OAuth response:', {
    hasData: !!data,
    hasError: !!error,
    errorMessage: error?.message,
    errorStatus: error?.status,
    hasUrl: !!data?.url,
    urlLength: data?.url?.length
  });

  if (error) {
    console.error('[AUTH DEBUG] OAuth error details:', {
      message: error.message,
      status: error.status,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }

  console.log('[AUTH DEBUG] Step 6: OAuth URL received');
  console.log('[AUTH DEBUG] OAuth URL (first 100 chars):', data?.url?.substring(0, 100));
  
  // Check for OAuth state in storage after initiation
  console.log('[AUTH DEBUG] Step 6a: Checking OAuth state after initiation');
  const oauthKeys: string[] = Object.keys(localStorage).filter(k => 
    k.includes('auth') || k.includes('sb-') || k.includes('pkce')
  );
  console.log('[AUTH DEBUG] OAuth keys in localStorage after initiation:', oauthKeys);
  
  // Automatically redirect to OAuth URL
  if (data?.url) {
    console.log('[AUTH DEBUG] Step 7: Redirecting to OAuth URL');
    console.log('[AUTH DEBUG] Full OAuth URL:', data.url);
    console.log('[AUTH DEBUG] === GOOGLE SIGN-IN REDIRECTING ===');
    
    // Add a small delay to ensure logging is complete
    setTimeout(() => {
      window.location.href = data.url;
    }, 100);
  } else {
    console.error('[AUTH DEBUG] No OAuth URL received from Supabase');
    console.error('[AUTH DEBUG] Full OAuth response data:', data);
    throw new Error('No OAuth URL received');
  }

  return data;
}
