"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();
    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 15000);

    (async () => {
      const code = sp.get("code");
      const errorParam = sp.get("error");
      const next = sp.get("next") || "/dashboard";

      if (errorParam) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      // IMPORTANT: Do NOT auto-relaunch Google if verifier is missing; stop with a clear error.
      const hasVerifier = (() => {
        try {
          return !!localStorage.getItem("supabase.auth.token-code-verifier") ||
                 Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier"));
        } catch { return false; }
      })();
      if (!hasVerifier) {
        return router.replace("/sign-in?error=missing_verifier");
      }

      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // Scrub code/state to prevent repeat exchanges
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) return router.replace("/sign-in?error=exchange_failed");

      const { data: { session } } = await sb.auth.getSession();
      if (!session) return router.replace("/sign-in?error=no_session");

      router.replace(next);
    })().finally(() => { finished = true; clearTimeout(timeout); });
  }, [router, sp]);

  return null;
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
