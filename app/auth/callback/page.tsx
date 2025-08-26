"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient();
        const url = new URL(window.location.href);

        // If we have a code, exchange it for a session
        const hasCode = url.searchParams.has("code");
        const hasError = url.searchParams.get("error");

        if (hasError) {
          // Redirect back to sign-in with a clean error note
          router.replace("/sign-in?error=oauth_error");
          return;
        }

        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession({
            queryParams: url.searchParams,
          });

          // Clean URL so back/refresh doesn't re-run the exchange
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
          window.history.replaceState({}, "", clean);

          if (error) {
            console.error("[AUTH DEBUG] exchange failed:", error);
            router.replace("/sign-in?error=exchange_failed");
            return;
          }
        }

        // Success → go to dashboard
        router.replace("/dashboard");
      } catch (e) {
        console.error("[AUTH DEBUG] callback error:", e);
        router.replace("/sign-in?error=callback_crash");
      }
    };
    run();
  }, [router]);

  // Render nothing (or a tiny invisible div) so there are no links/buttons shown
  return <div aria-hidden="true" className="h-0 w-0 overflow-hidden" />;
}
