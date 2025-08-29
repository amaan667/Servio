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
  } catch (error) {
    // Silent error handling
  }

  const redirectTo = `${window.location.origin}/auth/callback`;

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo,
      // queryParams: { prompt: 'select_account' } // optional
    },
  });

  if (error) {
    throw error;
  }

  return data;
}
