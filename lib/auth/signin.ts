"use client";
import { createClient } from "@/lib/sb-client";
import { siteOrigin } from "@/lib/site";
import { generateCodeVerifier, generateCodeChallenge, storePkceVerifier, getPkceVerifier, clearPkceVerifier } from './pkce-utils.js';

function maskValue(value: string | null | undefined, opts: { prefix?: number; suffix?: number } = {}) {
  if (!value) return { present: false };
  const prefix = opts.prefix ?? 6;
  const suffix = opts.suffix ?? 4;
  const len = value.length;
  const masked = len > prefix + suffix
    ? `${value.slice(0, prefix)}...${value.slice(-suffix)}`
    : `${value.slice(0, Math.min(prefix, len))}`;
  return { present: true, length: len, preview: masked };
}

function sanitizeUrlMaskClientId(urlString: string | null | undefined) {
  if (!urlString) return { url: urlString };
  try {
    const u = new URL(urlString);
    if (u.searchParams.has('client_id')) {
      const cid = u.searchParams.get('client_id');
      const masked = maskValue(cid);
      if (cid) u.searchParams.set('client_id', masked.preview || '***');
    }
    return { url: u.toString() };
  } catch {
    return { url: urlString };
  }
}

// Step 1 – Generate PKCE verifier and challenge
async function initPkceFlow() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  // Store in session storage for later
  storePkceVerifier(verifier);

  console.log('[OAuth Frontend] PKCE generated', {
    verifier: maskValue(verifier),
    challenge: maskValue(challenge),
    timestamp: new Date().toISOString(),
  });

  return challenge;
}

// Step 2 – Before redirecting to Google
async function redirectToGoogleAuth() {
  const challenge = await initPkceFlow();

  const params = new URLSearchParams({
    // Use the Google OAuth Client ID, not the Supabase anon key
    client_id: (process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || ''),
    redirect_uri: `${siteOrigin()}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  const fullUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  const sanitized = sanitizeUrlMaskClientId(fullUrl);
  console.log('[OAuth Frontend] Google OAuth URL (sanitized client_id)', { url: sanitized.url });
  window.location = fullUrl as any;
}

// Step 3 – On redirect/callback from Google
async function handleGoogleCallback(authCode) {
  if (!authCode) {
    console.error('[OAuth Frontend] Missing authorization code on callback');
    return;
  }

  // Only run the debug token exchange if a Google Client ID is configured client-side
  const googleClientId = (process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID || '').trim();
  if (!googleClientId) {
    console.log('[OAuth Frontend] Skipping server token exchange debug (NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID not set)');
    return;
  }

  const verifier = getPkceVerifier();
  console.log('[OAuth Frontend] Retrieved PKCE verifier before token exchange', { verifier: maskValue(verifier) });

  if (!verifier) {
    console.error('[OAuth Frontend] Error: No PKCE verifier found in storage');
    return;
  }

  // Exchange code + verifier for tokens (debug endpoint)
  const res = await fetch('/api/auth/google/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_code: authCode, verifier })
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {}

  const sanitized = json ? {
    ok: res.ok,
    status: res.status,
    hasAccessToken: !!json.access_token,
    hasRefreshToken: !!json.refresh_token,
    id_token_present: !!json.id_token,
    error: json.error,
    error_description: json.error_description,
    scope: json.scope,
    expires_in: json.expires_in,
  } : { ok: res.ok, status: res.status };

  console.log('[OAuth Frontend] Server response from token exchange (sanitized)', sanitized);
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
    console.log('[OAuth Frontend] About to initialize PKCE flow');
    try {
      const challenge = await initPkceFlow();
      console.log('[OAuth Frontend] PKCE flow initialized successfully', { challengeLength: challenge.length });
    } catch (pkceError) {
      console.error('[OAuth Frontend] Failed to initialize PKCE flow', pkceError);
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

    // Log the exact Google OAuth URL with masked client_id for debugging
    try {
      const sanitized = sanitizeUrlMaskClientId(data.url);
      console.log('[OAuth Frontend] Redirecting to Google OAuth URL (sanitized client_id)', { url: sanitized.url });
    } catch {}

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
