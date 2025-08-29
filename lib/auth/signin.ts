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
  } catch {}

  // Use window.location.origin for client-side redirect URL
  const redirectTo = `${window.location.origin}/auth/callback`;
  
  console.log('[AUTH DEBUG] Starting Google OAuth with redirect:', redirectTo);

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      flowType: "pkce",
      redirectTo: redirectTo,
    },
  });

  if (error) {
    console.error('[AUTH DEBUG] OAuth initiation failed:', error);
    throw error;
  }

  console.log('[AUTH DEBUG] OAuth initiated successfully, redirecting to:', data.url);
  return data;
}
