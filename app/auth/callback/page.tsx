"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const supabase = createClient();

    const bail = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 6000);

    (async () => {
      try {
        const err = sp.get("error");
        const code = sp.get("code");
        const next = sp.get("next") || "/dashboard";

        if (err) return router.replace("/sign-in?error=oauth_error");
        if (!code) return router.replace("/sign-in?error=missing_code");

        const { error } = await supabase.auth.exchangeCodeForSession({
          queryParams: new URLSearchParams(window.location.search),
        });

        // Clean the URL to avoid re-exchange on back/refresh
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

        if (error) {
          // PKCE verifier missing or mismatch → restart cleanly once
          try {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
            });
          } catch {}
          const origin = window.location.origin;
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${origin}/auth/callback`, flowType: "pkce" },
          });
          return;
        }

        router.replace(next);
      } finally {
        finished = true;
        clearTimeout(bail);
      }
    })();
  }, [router, sp]);

  // Silent page: render nothing
  return null;
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackContent />
    </Suspense>
  );
}

