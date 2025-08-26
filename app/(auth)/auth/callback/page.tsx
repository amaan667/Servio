"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 20000);

    (async () => {
      const err = sp.get("error");
      const code = sp.get("code");
      const next = sp.get("next") || "/dashboard";
      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      // 1) Exchange PKCE on the client (has localStorage)
      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // 2) Clean URL so refresh/back doesn't retry
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

      if (error) {
        // Clear stale PKCE and restart once
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
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

  return null; // no UI
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
