"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearAuthState } from "@/lib/auth-recovery";

export const dynamic = "force-dynamic";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    const timeout = setTimeout(() => {
      if (!finished) {
        console.error('[AUTH CALLBACK] Timeout - redirecting to sign-in');
        router.replace("/sign-in?error=timeout");
      }
    }, 20000);

    (async () => {
      try {
        const err = sp.get("error");
        const code = sp.get("code");
        const next = sp.get("next") || "/dashboard";
        
        console.log('[AUTH CALLBACK] Processing callback:', { 
          hasError: !!err, 
          hasCode: !!code, 
          next 
        });

        if (err) {
          console.error('[AUTH CALLBACK] OAuth error:', err);
          return router.replace("/sign-in?error=oauth_error");
        }
        
        if (!code) {
          console.error('[AUTH CALLBACK] No code parameter');
          return router.replace("/sign-in?error=missing_code");
        }

        // 1) Exchange PKCE on the client (has localStorage)
        console.log('[AUTH CALLBACK] Exchanging code for session');
        const { data, error } = await sb.auth.exchangeCodeForSession({
          queryParams: new URLSearchParams(window.location.search),
        });

        if (error) {
          console.error('[AUTH CALLBACK] Code exchange failed:', error);
          
          // Check if it's a PKCE/auth state error
          if (error.message?.includes('PKCEGrantParams') || 
              error.message?.includes('auth_code') ||
              error.message?.includes('invalid_grant')) {
            
            console.log('[AUTH CALLBACK] PKCE error detected, clearing auth state and retrying');
            
            // Clear potentially corrupted auth state
            await clearAuthState();
            
            // Retry OAuth flow once
            const origin = window.location.origin;
            await sb.auth.signInWithOAuth({
              provider: "google",
              options: { 
                flowType: "pkce", 
                redirectTo: `${origin}/auth/callback` 
              },
            });
            return; // navigates away
          }
          
          // For other errors, redirect to sign-in
          return router.replace("/sign-in?error=auth_failed");
        }

        // 2) Clean URL so refresh/back doesn't retry
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

        console.log('[AUTH CALLBACK] Authentication successful, redirecting to:', next);
        router.replace(next);
        
      } catch (error) {
        console.error('[AUTH CALLBACK] Unexpected error:', error);
        router.replace("/sign-in?error=unexpected");
      }
    })().finally(() => {
      finished = true;
      clearTimeout(timeout);
    });
  }, [router, sp]);

  return null; // no UI
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Completing sign in...</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
