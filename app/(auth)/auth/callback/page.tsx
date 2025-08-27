"use client";

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

      const retryKey = "sb_oauth_retry";
      const retried = (() => {
        try { return sessionStorage.getItem(retryKey) === "1"; } catch { return false; }
      })();

      const hasVerifier = (() => {
        try {
          const ls = localStorage;
          if (!ls) return false;
          return !!ls.getItem("supabase.auth.token-code-verifier") ||
                 Object.keys(ls).some(k => k.includes("pkce") || k.includes("token-code-verifier"));
        } catch { return false; }
      })();

      if (!hasVerifier && !retried) {
        try { sessionStorage.setItem(retryKey, "1"); } catch {}
        await sb.auth.signInWithOAuth({
          provider: "google",
          options: { flowType: "pkce", redirectTo: `${siteOrigin()}/auth/callback` }
        });
        return;
      }

      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search)
      });

      // Clean URL so refresh/back won't re-exchange
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code"); url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) {
        try {
          const ls = localStorage;
          if (ls) {
            Object.keys(ls).forEach(k => {
              if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
                ls.removeItem(k);
            });
          }
          sessionStorage.removeItem(retryKey);
        } catch {}
        router.replace("/sign-in?error=exchange_failed");
        return;
      }

      const { data: { session } } = await sb.auth.getSession();
      if (!session) return router.replace("/sign-in?error=no_session");

      try { sessionStorage.removeItem(retryKey); } catch {}
      router.replace(next);
    })().finally(() => {
      finished = true; clearTimeout(timeout);
    });
  }, [router, sp]);

  return null;
}