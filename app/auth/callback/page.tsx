"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export default function OAuthCallback() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
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
          setErrorMessage("Sign-in failed. Redirecting to try again...");
          const origin = getSiteUrl();
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${origin}/auth/callback`, flowType: "pkce" },
          });
          return;
        }

        // After successful exchange, send users to home so the header reflects signed-in state
        router.replace("/");
      } catch (e: any) {
        console.error("[auth] Callback exception:", e);
        setErrorMessage("Unexpected error during sign-in. Redirecting to sign-in page...");
        setTimeout(() => router.replace("/sign-in?error=callback_exception"), 500);
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-2 text-gray-700">Signing you in…</p>
        {errorMessage ? (
          <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
