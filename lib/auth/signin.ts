"use client";
import { createClient } from "@/lib/supabase/client";

export async function signInWithGoogle() {
  const sb = createClient();

  try {
    // Clear any stale OAuth state
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) {
        localStorage.removeItem(k);
      }
    });
    sessionStorage.removeItem("sb_oauth_retry");
    sessionStorage.removeItem("sb_oauth_in_progress");
  } catch (error) {
    // Silent error handling
  }

  const redirectTo = `${window.location.origin}/auth/callback`;

  console.log('[AUTH DEBUG] Starting Google OAuth with account selection forced');
  console.log('[AUTH DEBUG] Redirect URL:', redirectTo);

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo,
      flowType: 'pkce',
      queryParams: { 
        prompt: 'select_account',
        access_type: 'offline'
      }
    },
  });

  if (error) {
    console.error('[AUTH DEBUG] OAuth error:', error);
    throw error;
  }

  console.log('[AUTH DEBUG] OAuth initiated successfully, redirecting to:', data?.url);
  
  // Automatically redirect to OAuth URL
  if (data?.url) {
    window.location.href = data.url;
  }

  return data;
}
