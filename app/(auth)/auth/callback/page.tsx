"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export const dynamic = "force-dynamic";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = supabaseBrowser();

    // generous timeout to avoid "Authentication timed out"
    const t = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 20000);

    (async () => {
      const err = sp.get("error");
      const code = sp.get("code");
      const next = sp.get("next") || "/dashboard";

      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      const qp = new URLSearchParams(window.location.search);

      // 1) Normal PKCE exchange in browser
      let { error } = await sb.auth.exchangeCodeForSession({ queryParams: qp });

      // 2) If verifier missing/mismatch, clear stale state and restart once
      if (error) {
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
          });
        } catch {}
        const origin = window.location.origin;
        await sb.auth.signInWithOAuth({
          provider: "google",
          options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
        });
        return; // browser navigates away
      }

      // 3) Clean URL (avoid re-exchange on back/refresh)
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

      router.replace(next);
    })().finally(() => {
      finished = true;
      clearTimeout(t);
    });
  }, [router, sp]);

  return null; // **no UI**
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
