"use client";
export const dynamic = "force-dynamic";
export const revalidate = false;

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/site";

export default function OAuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 15000);

    (async () => {
      const err = sp.get("error");
      const code = sp.get("code");
      const next = sp.get("next") || "/dashboard";
      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      // One-time retry if PKCE verifier missing (prevents endless spinner)
      const retryKey = "sb_oauth_retry";
      const retried = (() => { try { return sessionStorage.getItem(retryKey) === "1"; } catch { return false; } })();
      const hasVerifier = (() => {
        try {
          return !!localStorage.getItem("supabase.auth.token-code-verifier") ||
                 Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier"));
        } catch { return false; }
      })();

      if (!hasVerifier && !retried) {
        try { sessionStorage.setItem(retryKey, "1"); } catch {}
        await sb.auth.signInWithOAuth({
          provider: "google",
          options: { flowType: "pkce", redirectTo: `${siteOrigin()}/auth/callback` },
        });
        return; // navigates to Google again
      }

      // Perform the PKCE exchange in the browser
      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // Clean URL to prevent re-exchange on refresh/back
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) {
        // Stop loop and fail clean
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) localStorage.removeItem(k);
          });
          sessionStorage.removeItem(retryKey);
        } catch {}
        router.replace("/sign-in?error=exchange_failed");
        return;
      }

      // Confirm session is actually set
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return router.replace("/sign-in?error=no_session");

      try { sessionStorage.removeItem(retryKey); } catch {}
      router.replace(next);
    })().finally(() => { finished = true; clearTimeout(timeout); });
  }, [router, sp]);

  return null; // no UI so it never "hangs" on a spinner
}