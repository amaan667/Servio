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

    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 20000); // give PKCE plenty of time

    (async () => {
      const err = sp.get("error");
      const code = sp.get("code");
      const next = sp.get("next") || "/dashboard";
      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      const qp = new URLSearchParams(window.location.search);

      // 1) Attempt normal exchange
      let { error } = await supabase.auth.exchangeCodeForSession({ queryParams: qp });

      // 2) If the verifier was missing, retry once by restarting OAuth cleanly
      if (error) {
        try {
          // Clear any stale PKCE/local storage
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
          });
        } catch {}
        const origin = window.location.origin;
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
        });
        return; // browser leaves this page
      }

      // 3) Clean URL (remove code/state) and go to dashboard
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
      router.replace(next);
    })()
      .finally(() => {
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

