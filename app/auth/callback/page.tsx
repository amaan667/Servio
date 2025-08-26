"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let done = false;
    const supabase = createClient();

    const fallthrough = setTimeout(() => {
      if (!done) router.replace("/sign-in?error=timeout");
    }, 6000);

    (async () => {
      try {
        const hasErr = sp.get("error");
        const hasCode = !!sp.get("code");
        if (hasErr) return router.replace("/sign-in?error=oauth_error");
        if (!hasCode) return router.replace("/sign-in?error=missing_code");

        const { error } = await supabase.auth.exchangeCodeForSession({
          queryParams: new URLSearchParams(window.location.search),
        });

        // Clean the query so refresh/back doesn't retry
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

        if (error) {
          console.error("[auth] PKCE exchange failed:", error);
          return router.replace("/sign-in?error=exchange_failed");
        }

        const next = sp.get("next") || "/dashboard";
        router.replace(next);
      } finally {
        done = true;
        clearTimeout(fallthrough);
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
