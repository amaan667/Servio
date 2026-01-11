"use client";
import { createClient } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";

export async function signInWithGoogle() {
  const sb = await createClient();

  // Clear OAuth progress flags from previous attempts
  try {
    sessionStorage.removeItem("sb_oauth_retry");
    sessionStorage.removeItem("sb_oauth_in_progress");
  } catch (_error) {
    // Silent error handling
  }

  const redirectTo = getAuthRedirectUrl("/auth/callback");

  // Test Supabase connection before OAuth
  try {
    const { data: testData, error: testError } = await sb.auth.getSession();

  } catch (e) {
    // Error handled
  }

  // Clear unknown existing OAuth state before starting
  try {
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());
  } catch (e) {
    // Error handled
  }

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo,
      queryParams: {
        prompt: "select_account",
        access_type: "offline",
      },
    },
  });

  if (error) {
    throw error;
  }

  // Check for OAuth state in storage after initiation
  const oauthKeys: string[] = Object.keys(localStorage).filter(
    (k) => k.includes("auth") || k.includes("sb-") || k.includes("pkce")
  );

  // Automatically redirect to OAuth URL
  if (data?.url) {
    // Redirect immediately - no artificial delay
    window.location.href = data.url;
  } else {
    throw new Error("No OAuth URL received");
  }

  return data;
}
