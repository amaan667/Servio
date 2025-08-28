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

    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        flowType: "pkce",
        redirectTo: redirectUrl,
      },
    });

    console.log('[AUTH DEBUG] signInWithGoogle: OAuth response', { 
      hasData: !!data, 
      hasError: !!error, 
      errorMessage: error?.message,
      url: data?.url,
      timestamp: new Date().toISOString()
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('No redirect URL received from OAuth provider');
    }

    // The redirect should happen automatically, but let's ensure it does
    console.log('[AUTH DEBUG] signInWithGoogle: redirecting to', data.url);
    window.location.href = data.url;
    
  } catch (error: any) {
    console.error('[AUTH DEBUG] signInWithGoogle: error', { 
      message: error?.message, 
      name: error?.name,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}
