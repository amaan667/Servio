"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function CallbackInner() {
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
      } catch {}

      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) {
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

      try { sessionStorage.removeItem(retryKey); } catch {}
      router.replace(next);
    })().finally(() => {
      finished = true;
      clearTimeout(timeout);
    });
  }, [router, sp]);

  return null;
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}