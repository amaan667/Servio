"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const hasCode = url.searchParams.has("code");
      const hasErr = url.searchParams.get("error");

      if (hasErr) {
        router.replace("/sign-in?error=oauth_error");
        return;
      }

      if (!hasCode) {
        router.replace("/sign-in?error=missing_code");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession({
        queryParams: url.searchParams,
      } as any);

      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState(
        {},
        "",
        url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "")
      );

      if (error) {
        console.error("[auth] PKCE exchange failed:", error);
        const origin = getSiteUrl();
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${origin}/auth/callback`, flowType: "pkce" },
        });
        return;
      }

      router.replace("/dashboard");
    })();
  }, [router]);

  return null;
}
