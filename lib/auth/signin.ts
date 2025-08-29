"use client";
import { createClient } from "@/lib/sb-client";
import { siteOrigin } from "@/lib/site";
import { clearPkceVerifier } from './pkce-utils.js';

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

export async function signInWithGoogle() {
  const sb = createClient();
  const origin = siteOrigin();
  const redirectUrl = `${origin}/auth/callback`;

  console.log('[AUTH DEBUG] signInWithGoogle: starting', { 
    origin,
    redirectUrl, 
    windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'undefined',
    envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'undefined',
    isMobile: typeof window !== 'undefined' ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false,
    timestamp: new Date().toISOString()
  });

  try {
    // Universal storage clearing for all platforms
    const clearedKeys: string[] = [];
    
    // Clear localStorage with comprehensive key detection
    const localStorageKeys = Object.keys(localStorage).filter(k => 
      k.startsWith("sb-") || 
      k.includes("pkce") || 
      k.includes("token-code-verifier") || 
      k.includes("code_verifier") ||
      k.includes("auth") ||
      k.includes("verifier")
    );
    localStorageKeys.forEach(k => {
      localStorage.removeItem(k);
      clearedKeys.push(`local:${k}`);
    });
    
    // Clear sessionStorage with comprehensive key detection
    const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
      k.startsWith("sb-") || 
      k.includes("pkce") || 
      k.includes("token-code-verifier") || 
      k.includes("code_verifier") ||
      k.includes("auth") ||
      k.includes("verifier") ||
      k.includes("oauth")
    );
    sessionStorageKeys.forEach(k => {
      sessionStorage.removeItem(k);
      clearedKeys.push(`session:${k}`);
    });
    
    // Clear our custom PKCE verifier from all locations
    clearPkceVerifier();
    
    console.log('[AUTH DEBUG] signInWithGoogle: cleared keys', { 
      clearedKeys, 
      localStorageCount: localStorageKeys.length,
      sessionStorageCount: sessionStorageKeys.length
    });

    // Ensure we're starting with a clean state
    await sb.auth.signOut({ scope: 'local' });

    // Universal delay for all platforms
    const storageDelay = 200;
    console.log('[AUTH DEBUG] signInWithGoogle: waiting for storage to clear', { delay: storageDelay });
    await new Promise(resolve => setTimeout(resolve, storageDelay));

    // Use Supabase's built-in PKCE flow
    console.log('[OAuth Frontend] Using universal Supabase built-in PKCE flow');

    // For desktop, we might want to use a different approach to avoid popup issues
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        flowType: "pkce",
        redirectTo: redirectUrl,
        // For desktop, we might want to force a redirect instead of popup
        ...(isMobile ? {} : { skipBrowserRedirect: false }),
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
      isMobile,
      urlLength: data?.url?.length,
      timestamp: new Date().toISOString()
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('No redirect URL received from OAuth provider');
    }

    // Store OAuth progress flags
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());

    // Log the exact Google OAuth URL with masked client_id for debugging
    try {
      const sanitized = sanitizeUrlMaskClientId(data.url);
      console.log('[OAuth Frontend] Redirecting to Google OAuth URL (sanitized client_id)', { 
        url: sanitized.url
      });
    } catch {}

    // Universal redirect to OAuth provider
    console.log('[AUTH DEBUG] signInWithGoogle: redirecting to', data.url);
    
    // For desktop, we might want to use a more direct approach
    if (isMobile) {
      window.location.href = data.url;
    } else {
      // On desktop, try to open in the same window to avoid popup issues
      window.location.href = data.url;
    }
    
  } catch (error: any) {
    console.error('[AUTH DEBUG] signInWithGoogle: error', { 
      message: error?.message, 
      name: error?.name,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'undefined',
      timestamp: new Date().toISOString()
    });
    
    // Clear any OAuth progress flags on error
    sessionStorage.removeItem("sb_oauth_in_progress");
    sessionStorage.removeItem("sb_oauth_start_time");
    
    throw error;
  }
}
