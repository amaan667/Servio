"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function CallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();
    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 15000);

    (async () => {
      const err = sp.get("error");
      const code = sp.get("code");
      const next = sp.get("next") || "/dashboard";
      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      // Single retry guard - never retry OAuth from callback
      const retryKey = "sb_oauth_retry";
      let hasRetried = false;
      try { 
        hasRetried = sessionStorage.getItem(retryKey) === "1"; 
      } catch {}

      // Check for PKCE verifier
      let hasVerifier = false;
      try {
        hasVerifier = typeof localStorage !== "undefined" &&
          (localStorage.getItem("supabase.auth.token-code-verifier") ||
           Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier")));
      } catch {}

      // If no verifier and haven't retried, this is likely a stale/wrong callback
      // Don't auto-retry OAuth - just redirect to sign-in with error
      if (!hasVerifier) {
        // Clear any stale auth state
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
              localStorage.removeItem(k);
          });
          sessionStorage.removeItem(retryKey);
        } catch {}
        
        router.replace("/sign-in?error=pkce_failed&message=Authentication state was lost. Please sign in again.");
        return;
      }

      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) {
        // Clear all auth state on exchange failure
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
              localStorage.removeItem(k);
          });
          sessionStorage.removeItem(retryKey);
        } catch {}
        router.replace(`/sign-in?error=exchange_failed&message=${encodeURIComponent(error.message || "Authentication failed")}`);
        return;
      }

      // Success - clear retry flag and redirect
      try { 
        sessionStorage.removeItem(retryKey);
        // Also clear PKCE verifier after successful exchange
        Object.keys(localStorage).forEach(k => {
          if (k.includes("pkce") || k.includes("token-code-verifier"))
            localStorage.removeItem(k);
        });
      } catch {}
      router.replace(next);
    })().finally(() => {
      finished = true;
      clearTimeout(timeout);
    });
  }, [router, sp]);

  return null;
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}