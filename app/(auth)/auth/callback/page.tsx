"use client";
export const dynamic = "force-dynamic";
export const revalidate = false;

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OAuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    (async () => {
      // Try to read from ?query and fallback to #hash if needed
      let qs = new URLSearchParams(window.location.search);
      if (!qs.get("code") && window.location.hash?.includes("code=")) {
        qs = new URLSearchParams(window.location.hash.slice(1));
      }

      // Debug log (remove if you prefer)
      // eslint-disable-next-line no-console
      console.log("[AUTH DEBUG] callback URL", {
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        codePresent: !!qs.get("code"),
      });

      const code = qs.get("code");
      const err = qs.get("error");
      const next = sp.get("next") || "/dashboard";

      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      const { error } = await sb.auth.exchangeCodeForSession({ queryParams: qs });

      // scrub params to avoid accidental re-exchange on refresh
      try {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        window.history.replaceState({}, "", url.toString());
      } catch {}

      if (error) return router.replace("/sign-in?error=exchange_failed");

      const { data: { session } } = await sb.auth.getSession();
      if (!session) return router.replace("/sign-in?error=no_session");

      router.replace(next);
    })().finally(() => { finished = true; });
  }, [router, sp]);

  return null;
}
