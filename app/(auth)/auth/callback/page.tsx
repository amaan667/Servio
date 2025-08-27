"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OAuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    // 15s hard timeout so we never hang
    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 15000);

    (async () => {
      const err = sp?.get("error");
      const code = sp?.get("code");
      const next = sp?.get("next") || "/dashboard";

      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      // Guard: if PKCE verifier isn't present in browser storage, immediately restart OAuth
      try {
        const keys = Object.keys(localStorage);
        const hasVerifier =
          keys.some(k => k.includes("token-code-verifier") || k.includes("pkce")) ||
          !!localStorage.getItem("supabase.auth.token-code-verifier");

        if (!hasVerifier) {
          const origin = window.location.origin;
          await sb.auth.signInWithOAuth({
            provider: "google",
            options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
          });
          return; // navigates away, no spinner
        }
      } catch { /* ignore */ }

      // Exchange PKCE **in the browser**
      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // Always scrub query params to avoid re-exchange on back/refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

      if (error) {
        // Clear stale PKCE artifacts and restart once
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
              localStorage.removeItem(k);
          });
        } catch {}
        const origin = window.location.origin;
        await sb.auth.signInWithOAuth({
          provider: "google",
          options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
        });
        return; // navigates away
      }

      router.replace(next);
    })().finally(() => {
      finished = true;
      clearTimeout(timeout);
    });
  }, [router, sp]);

  return null; // absolutely no UI
}