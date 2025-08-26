"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OAuthCallback() {
  const r = useRouter();
  useEffect(() => {
    (async () => {
      const sb = createClient();
      const url = new URL(window.location.href);
      const hasCode = url.searchParams.has("code");
      const hasErr = url.searchParams.get("error");

      if (hasErr) return r.replace("/sign-in?error=oauth_error");

      if (hasCode) {
        const { error } = await sb.auth.exchangeCodeForSession({ queryParams: url.searchParams });
        url.searchParams.delete("code"); url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
        if (error) return r.replace("/sign-in?error=exchange_failed");
      }
      r.replace("/dashboard");
    })();
  }, [r]);
  return null;
}
