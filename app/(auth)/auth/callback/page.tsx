"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/sb-client";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();
    
    console.log('[AUTH DEBUG] callback: starting', { 
      url: window.location.href,
      searchParams: Object.fromEntries(sp.entries()),
      timestamp: new Date().toISOString()
    });

    const timeout = setTimeout(() => {
      if (!finished) {
        console.log('[AUTH DEBUG] callback: timeout reached');
        router.replace("/sign-in?error=timeout");
      }
    }, 15000);

    (async () => {
      const code = sp.get("code");
      const errorParam = sp.get("error");
      const next = sp.get("next") || "/dashboard";

      console.log('[AUTH DEBUG] callback: processing params', { 
        hasCode: !!code, 
        errorParam, 
        next,
        timestamp: new Date().toISOString()
      });

      if (errorParam) {
        console.log('[AUTH DEBUG] callback: error param found', { errorParam });
        return router.replace("/sign-in?error=oauth_error");
      }
      
      if (!code) {
        console.log('[AUTH DEBUG] callback: no code found');
        return router.replace("/sign-in?error=missing_code");
      }

      // IMPORTANT: Do NOT auto-relaunch Google if verifier is missing; stop with a clear error.
      const hasVerifier = (() => {
        try {
          const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
          const hasPkceKeys = Object.keys(localStorage).some(k => k.includes("pkce") || k.includes("token-code-verifier"));
          console.log('[AUTH DEBUG] callback: verifier check', { 
            hasVerifier: !!verifier, 
            hasPkceKeys,
            timestamp: new Date().toISOString()
          });
          return !!verifier || hasPkceKeys;
        } catch (err) { 
          console.log('[AUTH DEBUG] callback: verifier check failed', { error: err });
          return false; 
        }
      })();
      
      if (!hasVerifier) {
        console.log('[AUTH DEBUG] callback: missing verifier');
        return router.replace("/sign-in?error=missing_verifier");
      }

      console.log('[AUTH DEBUG] callback: exchanging code for session');
      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // Scrub code/state to prevent repeat exchanges
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : ""));
      } catch {}

      if (error) {
        console.log('[AUTH DEBUG] callback: exchange failed', { error: error.message });
        return router.replace("/sign-in?error=exchange_failed");
      }

      console.log('[AUTH DEBUG] callback: getting session');
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        console.log('[AUTH DEBUG] callback: no session after exchange');
        return router.replace("/sign-in?error=no_session");
      }

      console.log('[AUTH DEBUG] callback: success, redirecting to', { next, userId: session.user.id });
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
      <OAuthCallbackContent />
    </Suspense>
  );
}
