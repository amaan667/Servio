"use client";
import { createClient } from "@/lib/sb-client";
import { siteOrigin } from "@/lib/site";
import { generateCodeVerifier, generateCodeChallenge, storePkceVerifier, getPkceVerifier, clearPkceVerifier } from './pkce-utils.js';

// Step 1 – Generate PKCE verifier and challenge
async function initPkceFlow() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Store in session storage for later
  storePkceVerifier(verifier);

  console.log('[PKCE Init] Generated verifier:', verifier);
  console.log('[PKCE Init] Generated challenge:', challenge);

  return challenge;
}

// Step 2 – Before redirecting to Google
async function redirectToGoogleAuth() {
  const challenge = await initPkceFlow();

  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    redirect_uri: `${siteOrigin()}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  console.log('[Google Auth] Redirecting with params:', params.toString());
  window.location = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Step 3 – On redirect/callback from Google
async function handleGoogleCallback(authCode) {
  const verifier = getPkceVerifier();
  console.log('[PKCE Callback] Using verifier from storage:', verifier);

  if (!verifier) {
    console.error('[PKCE ERROR] No verifier found in storage!');
    return;
  }

  // Exchange code + verifier for tokens
  const res = await fetch('/api/auth/google/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: authCode, verifier })
  });

  console.log('[PKCE Exchange] Response:', await res.json());
}

// Export the callback handler for use in the callback page
export { handleGoogleCallback };

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
    
    // Clear our custom PKCE verifier as well
    clearPkceVerifier();
    
    console.log('[AUTH DEBUG] signInWithGoogle: cleared keys', { clearedKeys });

    // Ensure we're starting with a clean state
    await sb.auth.signOut({ scope: 'local' });

    // Wait a moment for storage to clear, especially important for mobile browsers
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize PKCE flow for debugging
    console.log('[PKCE DEBUG] About to initialize PKCE flow...');
    try {
      const challenge = await initPkceFlow();
      console.log('[PKCE DEBUG] PKCE flow initialized successfully, challenge length:', challenge.length);
    } catch (pkceError) {
      console.error('[PKCE DEBUG] Failed to initialize PKCE flow:', pkceError);
    }

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
        const customVerifier = getPkceVerifier();
        const hasPkceKeys = Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier"));
        const hasCustomPkceKey = Object.keys(sessionStorage).some(k => k.includes("pkce_verifier"));
        
        console.log('[AUTH DEBUG] signInWithGoogle: verifier check before redirect', { 
          hasVerifier: !!verifier, 
          hasCustomVerifier: !!customVerifier,
          hasPkceKeys,
          hasCustomPkceKey,
          verifierLength: verifier?.length,
          customVerifierLength: customVerifier?.length,
          timestamp: new Date().toISOString()
        });
        return !!verifier || !!customVerifier || hasPkceKeys;
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
