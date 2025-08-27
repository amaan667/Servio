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

    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 15000);

    (async () => {
      const err = sp.get("error");
      const code = sp.get("code");
      const next = sp.get("next") || "/dashboard";
      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      // 1) If no verifier, restart **once** (guarded)
      const retryKey = "sb_oauth_retry";
      let retried = false;
      try { retried = sessionStorage.getItem(retryKey) === "1"; } catch {}

      try {
        const hasVerifier =
          typeof localStorage !== "undefined" &&
          (localStorage.getItem("supabase.auth.token-code-verifier") ||
           Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier")));

        if (!hasVerifier && !retried) {
          sessionStorage.setItem(retryKey, "1");
          const origin = window.location.origin;
          await sb.auth.signInWithOAuth({
            provider: "google",
            options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
          });
          return;
        }
      } catch {
        // if storage is inaccessible, just fall through to exchange and let it fail once
      }

      // 2) Exchange PKCE in the **browser**
      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // 3) Clean URL so back/refresh won't re-exchange
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) {
        // 4) On failure, clear PKCE once and send to /sign-in (no auto-retry loop)
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
              localStorage.removeItem(k);
          });
          sessionStorage.removeItem(retryKey);
        } catch {}
        router.replace("/sign-in?error=exchange_failed");
        return;
      }

      // success
      try { sessionStorage.removeItem(retryKey); } catch {}
      router.replace(next);
    })().finally(() => {
      finished = true;
      clearTimeout(timeout);
    });
  }, [router, sp]);

  return null; // no UI; no header
}