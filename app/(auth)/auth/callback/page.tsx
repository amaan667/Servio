"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function OAuthCallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    console.log('[AUTH DEBUG] ===== Auth Callback Page Loaded =====');
    console.log('[AUTH DEBUG] Current URL:', window.location.href);
    console.log('[AUTH DEBUG] Search params:', window.location.search);
    
    let finished = false;
    const sb = createClient();

    // Listen for auth state changes
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      console.log('[AUTH DEBUG] Auth state change in callback:', {
        event,
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email
      });
    });

    // 15s hard timeout so we never hang
    const timeout = setTimeout(() => {
      if (!finished) router.replace("/sign-in?error=timeout");
    }, 15000);

    (async () => {
      console.log('[AUTH DEBUG] Processing callback parameters...');
      const err = sp?.get("error");
      const code = sp?.get("code");
      const next = sp?.get("next") || "/dashboard";
      
      console.log('[AUTH DEBUG] Callback params:', { err, hasCode: !!code, next });

      if (err) return router.replace("/sign-in?error=oauth_error");
      if (!code) return router.replace("/sign-in?error=missing_code");

      // Guard: if PKCE verifier isn't present in browser storage, immediately restart OAuth
      try {
        const keys = Object.keys(localStorage);
        const hasVerifier =
          keys.some(k => k.includes("token-code-verifier") || k.includes("pkce")) ||
          !!localStorage.getItem("supabase.auth.token-code-verifier");

        if (!hasVerifier) {
          const origin = "https://servio-production.up.railway.app";
          await sb.auth.signInWithOAuth({
            provider: "google",
            options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
          });
          return; // navigates away, no spinner
        }
      } catch { /* ignore */ }

      // Exchange PKCE **in the browser**
      const { error } = await sb.auth.exchangeCodeForSession({
        queryParams: new URLSearchParams(window.location.search),
      });

      // Always scrub query params to avoid re-exchange on back/refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

      if (error) {
        // Clear stale PKCE artifacts and restart once
        try {
          Object.keys(localStorage).forEach(k => {
            if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier"))
              localStorage.removeItem(k);
          });
        } catch {}
        const origin = "https://servio-production.up.railway.app";
        await sb.auth.signInWithOAuth({
          provider: "google",
          options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
        });
        return; // navigates away
      }

      console.log('[AUTH DEBUG] ✅ Exchange successful, redirecting to:', next);
      
      // Verify session was established
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      console.log('[AUTH DEBUG] Session verification after exchange:', {
        hasSession: !!sessionData.session,
        hasUser: !!sessionData.session?.user,
        userId: sessionData.session?.user?.id,
        userEmail: sessionData.session?.user?.email,
        sessionError: sessionError?.message
      });
      
      if (!sessionData.session) {
        console.log('[AUTH DEBUG] ❌ No session established after exchange, redirecting to sign-in');
        router.replace("/sign-in?error=no_session");
        return;
      }
      
      router.replace(next);
    })().finally(() => {
      finished = true;
      clearTimeout(timeout);
      subscription?.unsubscribe();
    });
  }, [router, sp]);

  return null; // absolutely no UI
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackInner />
    </Suspense>
  );
}