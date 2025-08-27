"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/site";

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

      // One-time retry if verifier is missing
      const retryKey = "sb_oauth_retry";
      const retried = (() => { 
        try { 
          return sessionStorage.getItem(retryKey) === "1"; 
        } catch { 
          return false; 
        } 
      })();
      
      const hasVerifier = (() => {
        try {
          return !!localStorage.getItem("sb-auth-token-code-verifier") ||
                 Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier"));
        } catch { 
          return false; 
        }
      })();

      if (!hasVerifier && !retried) {
        try { 
          sessionStorage.setItem(retryKey, "1"); 
        } catch {}
        
        await sb.auth.signInWithOAuth({
          provider: "google",
          options: { 
            flowType: "pkce", 
            redirectTo: `${siteOrigin()}/auth/callback` 
          },
        });
        return;
      }

      // Exchange in the browser
      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // Clean the URL so refresh/back won't re-exchange
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code"); 
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) {
        // Stop loops and fail cleanly
        try {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) 
              localStorage.removeItem(k);
          });
          sessionStorage.removeItem(retryKey);
        } catch {}
        router.replace("/sign-in?error=exchange_failed");
        return;
      }

      // Sanity-check that we truly have a session
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return router.replace("/sign-in?error=no_session");

      try { 
        sessionStorage.removeItem(retryKey); 
      } catch {}
      
      router.replace(next);
    })().finally(() => { 
      finished = true; 
      clearTimeout(timeout); 
    });
  }, [router, sp]);

  return null; // no UI
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}