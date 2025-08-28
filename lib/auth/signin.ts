"use client";
import { createClient } from "@/lib/sb-client";
import { siteOrigin } from "@/lib/site";

export async function signInWithGoogle() {
  const sb = createClient();
  const origin = siteOrigin();
  const redirectUrl = `${origin}/auth/callback`;

  console.log('[AUTH DEBUG] signInWithGoogle: starting', { 
    origin,
    redirectUrl, 
    windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'undefined',
    envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'undefined',
    timestamp: new Date().toISOString()
  });

  try {
    // Clear stale PKCE artifacts to avoid verifier/code mismatches
    const clearedKeys: string[] = [];
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) {
        localStorage.removeItem(k);
        clearedKeys.push(k);
      }
    });
    sessionStorage.removeItem("sb_oauth_retry");
    
    console.log('[AUTH DEBUG] signInWithGoogle: cleared keys', { clearedKeys });

    // Ensure we're starting with a clean state
    await sb.auth.signOut({ scope: 'local' });

    // Wait a moment for storage to clear, especially important for mobile browsers
    await new Promise(resolve => setTimeout(resolve, 100));

    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        flowType: "pkce",
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    console.log('[AUTH DEBUG] signInWithGoogle: OAuth response', { 
      hasData: !!data, 
      hasError: !!error, 
      errorMessage: error?.message,
      url: data?.url,
      urlLength: data?.url?.length,
      timestamp: new Date().toISOString()
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('No redirect URL received from OAuth provider');
    }

    // Verify that PKCE verifier was stored before redirecting
    const verifierCheck = (() => {
      try {
        const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
        const hasPkceKeys = Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier"));
        console.log('[AUTH DEBUG] signInWithGoogle: verifier check before redirect', { 
          hasVerifier: !!verifier, 
          hasPkceKeys,
          verifierLength: verifier?.length,
          timestamp: new Date().toISOString()
        });
        return !!verifier || hasPkceKeys;
      } catch (err) { 
        console.log('[AUTH DEBUG] signInWithGoogle: verifier check failed', { error: err });
        return false; 
      }
    })();

    if (!verifierCheck) {
      console.error('[AUTH DEBUG] signInWithGoogle: PKCE verifier not found before redirect');
      throw new Error('PKCE verifier not properly initialized');
    }

    // Store a flag to indicate OAuth is in progress (useful for debugging)
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());

    // The redirect should happen automatically, but let's ensure it does
    console.log('[AUTH DEBUG] signInWithGoogle: redirecting to', data.url);
    
    // Use window.location.href for better mobile browser compatibility
    window.location.href = data.url;
    
  } catch (error: any) {
    console.error('[AUTH DEBUG] signInWithGoogle: error', { 
      message: error?.message, 
      name: error?.name,
      timestamp: new Date().toISOString()
    });
    
    // Clear any OAuth progress flags on error
    sessionStorage.removeItem("sb_oauth_in_progress");
    sessionStorage.removeItem("sb_oauth_start_time");
    
    throw error;
  }
}
