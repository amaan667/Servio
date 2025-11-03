"use client";
import { createClient } from "@/lib/supabase";
import { getAuthRedirectUrl } from "@/lib/auth";
import { authLogger as logger } from "@/lib/logger";

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

  logger.debug("[AUTH] Environment check:", {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    origin: window.location.origin,
  });

  logger.debug("[AUTH] Supabase config check:", {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + "...",
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  // Test Supabase connection before OAuth
  try {
    const { data: testData, error: testError } = await sb.auth.getSession();
    logger.debug("[AUTH] Session test:", {
      hasTestData: !!testData,
      hasTestError: !!testError,
      testErrorMessage: testError?.message,
    });
  } catch (testErr) {
  }

  // Clear unknown existing OAuth state before starting
  try {
    sessionStorage.setItem("sb_oauth_in_progress", "true");
    sessionStorage.setItem("sb_oauth_start_time", Date.now().toString());
  } catch (_e) {
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

  logger.debug("[AUTH] OAuth result:", {
    hasData: !!data,
    hasError: !!error,
    errorMessage: error?.message,
    errorStatus: error?.status,
    hasUrl: !!data?.url,
    urlLength: data?.url?.length,
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
