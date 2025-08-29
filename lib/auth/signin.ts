"use client";
import { createClient } from "@/lib/supabase/client";

export async function signInWithGoogle() {
  console.log('[AUTH DEBUG] signInWithGoogle: Starting OAuth flow...');
  
  const sb = createClient();

  try {
    console.log('[AUTH DEBUG] signInWithGoogle: Clearing stale OAuth state...');
    // Clear any stale OAuth state
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) {
        localStorage.removeItem(k);
        console.log(`[AUTH DEBUG] signInWithGoogle: Cleared localStorage key: ${k}`);
      }
    });
    sessionStorage.removeItem("sb_oauth_retry");
    console.log('[AUTH DEBUG] signInWithGoogle: Cleared sessionStorage sb_oauth_retry');
  } catch (error) {
    console.error('[AUTH DEBUG] signInWithGoogle: Error clearing storage:', error);
  }

  // Use window.location.origin for client-side redirect URL
  const redirectTo = `${window.location.origin}/auth/callback`;
  
  console.log('[AUTH DEBUG] signInWithGoogle: OAuth configuration:', {
    redirectTo,
    origin: window.location.origin,
    href: window.location.href,
    timestamp: new Date().toISOString()
  });

  console.log('[AUTH DEBUG] signInWithGoogle: Calling signInWithOAuth...');
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      flowType: "pkce",
      redirectTo: redirectTo,
    },
  });

  if (error) {
    console.error('[AUTH DEBUG] signInWithGoogle: OAuth initiation failed:', {
      error: error.message,
      status: error.status,
      name: error.name,
      timestamp: new Date().toISOString()
    });
    throw error;
  }

  console.log('[AUTH DEBUG] signInWithGoogle: OAuth initiated successfully:', {
    hasData: !!data,
    hasUrl: !!data?.url,
    url: data?.url,
    timestamp: new Date().toISOString()
  });
  
  return data;
}
