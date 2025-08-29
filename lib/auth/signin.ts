"use client";
import { createClient } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/site";

export async function signInWithGoogle() {
  const sb = createClient();

  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) {
        localStorage.removeItem(k);
      }
    });
    sessionStorage.removeItem("sb_oauth_retry");
  } catch {}

  await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      flowType: "pkce",
      // ✅ ALWAYS go to API first; it will 307 to /auth/callback **with** the full query
      redirectTo: `${siteOrigin()}/api/auth/callback`,
    },
  });
}
