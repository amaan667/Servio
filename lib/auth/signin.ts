"use client";
import { createClient } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/site";
import { debugPKCEState } from "@/lib/supabase/client";

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

  // Debug PKCE state before starting
  debugPKCEState();

  try {
    // Only clear OAuth progress flags, not PKCE state
    sessionStorage.removeItem("sb_oauth_in_progress");
    sessionStorage.removeItem("sb_oauth_start_time");
    
    // Don't clear Supabase storage - let Supabase manage PKCE state
    console.log('[AUTH DEBUG] signInWithGoogle: preserving PKCE state');

    // Ensure we're starting with a clean state but preserve PKCE artifacts
    await sb.auth.signOut({ scope: 'local' });

    // Use Supabase's built-in PKCE flow
    console.log('[OAuth Frontend] Using Supabase built-in PKCE flow');

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

    // Store OAuth progress flags
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());

    // Debug PKCE state after OAuth initiation
    debugPKCEState();

    // Log the exact Google OAuth URL with masked client_id for debugging
    try {
      const sanitized = sanitizeUrlMaskClientId(data.url);
      console.log('[OAuth Frontend] Redirecting to Google OAuth URL (sanitized client_id)', { 
        url: sanitized.url
      });
    } catch {}

    // Redirect to OAuth provider
    console.log('[AUTH DEBUG] signInWithGoogle: redirecting to', data.url);
    window.location.href = data.url;
    
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
