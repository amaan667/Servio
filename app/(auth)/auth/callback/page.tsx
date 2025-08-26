"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export const dynamic = "force-dynamic";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = supabaseBrowser();

    console.log('[AUTH DEBUG] ===== OAuth Callback Started =====');
    console.log('[AUTH DEBUG] Current URL:', window.location.href);
    console.log('[AUTH DEBUG] Search params:', Object.fromEntries(sp.entries()));
    console.log('[AUTH DEBUG] User agent:', navigator.userAgent);
    console.log('[AUTH DEBUG] Timestamp:', new Date().toISOString());

    // Increased timeout to 30 seconds to avoid "Authentication timed out"
    const t = setTimeout(() => {
      if (!finished) {
        console.log('[AUTH DEBUG] ❌ TIMEOUT: OAuth callback exceeded 30 seconds');
        console.log('[AUTH DEBUG] Current state when timeout occurred:', {
          finished,
          url: window.location.href,
          searchParams: Object.fromEntries(sp.entries())
        });
        router.replace("/sign-in?error=timeout");
      }
    }, 30000);

    (async () => {
      try {
        console.log('[AUTH DEBUG] 🔍 Step 1: Extracting URL parameters');
        const err = sp.get("error");
        const code = sp.get("code");
        const next = sp.get("next") || "/dashboard";
        const state = sp.get("state");

        console.log('[AUTH DEBUG] Extracted parameters:', {
          error: err,
          hasCode: !!code,
          codeLength: code?.length,
          next,
          hasState: !!state,
          stateLength: state?.length
        });

        if (err) {
          console.log('[AUTH DEBUG] ❌ ERROR: OAuth error detected', { error: err });
          return router.replace("/sign-in?error=oauth_error");
        }
        
        if (!code) {
          console.log('[AUTH DEBUG] ❌ ERROR: No code parameter found');
          console.log('[AUTH DEBUG] Available search params:', Object.fromEntries(sp.entries()));
          return router.replace("/sign-in?error=missing_code");
        }

        console.log('[AUTH DEBUG] ✅ Step 2: Code parameter found, starting exchange');
        console.log('[AUTH DEBUG] Code preview:', code.substring(0, 20) + '...');
        
        const qp = new URLSearchParams(window.location.search);
        console.log('[AUTH DEBUG] Query params for exchange:', Object.fromEntries(qp.entries()));

        // 1) Normal PKCE exchange in browser
        console.log('[AUTH DEBUG] 🔄 Step 3: Calling exchangeCodeForSession');
        const startTime = Date.now();
        
        let { error, data } = await sb.auth.exchangeCodeForSession({ queryParams: qp });
        
        const exchangeTime = Date.now() - startTime;
        console.log('[AUTH DEBUG] Exchange completed in', exchangeTime, 'ms');

        if (error) {
          console.log('[AUTH DEBUG] ❌ ERROR: Code exchange failed', { 
            error: error.message,
            errorCode: error.status,
            exchangeTime
          });
          
          // 2) If verifier missing/mismatch, clear stale state and restart once
          console.log('[AUTH DEBUG] 🔄 Step 4: Attempting recovery - clearing stale auth state');
          try {
            const keysToRemove = Object.keys(localStorage).filter(k => 
              k.startsWith("sb-") || k.includes("pkce")
            );
            console.log('[AUTH DEBUG] Keys to remove:', keysToRemove);
            
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith("sb-") || k.includes("pkce")) {
                localStorage.removeItem(k);
                console.log('[AUTH DEBUG] Removed key:', k);
              }
            });
            console.log('[AUTH DEBUG] ✅ Stale auth state cleared');
          } catch (clearError) {
            console.log('[AUTH DEBUG] ❌ ERROR: Failed to clear localStorage', { error: clearError });
          }
          
          const origin = window.location.origin;
          console.log('[AUTH DEBUG] 🔄 Step 5: Restarting OAuth flow with origin:', origin);
          
          try {
            const { data: oauthData, error: oauthError } = await sb.auth.signInWithOAuth({
              provider: "google",
              options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
            });
            
            if (oauthError) {
              console.log('[AUTH DEBUG] ❌ ERROR: OAuth restart failed', { error: oauthError });
              router.replace("/sign-in?error=oauth_restart_failed");
              return;
            }
            
            console.log('[AUTH DEBUG] ✅ OAuth restart initiated, browser should redirect');
            return; // browser navigates away
          } catch (restartError) {
            console.log('[AUTH DEBUG] ❌ ERROR: Exception during OAuth restart', { error: restartError });
            router.replace("/sign-in?error=oauth_restart_exception");
            return;
          }
        }

        console.log('[AUTH DEBUG] ✅ Step 4: Code exchange successful');
        console.log('[AUTH DEBUG] Session data:', {
          hasSession: !!data.session,
          userId: data.session?.user?.id,
          userEmail: data.session?.user?.email,
          sessionExpiresAt: data.session?.expires_at,
          accessTokenLength: data.session?.access_token?.length
        });

        // 3) Clean URL (avoid re-exchange on back/refresh)
        console.log('[AUTH DEBUG] 🔄 Step 5: Cleaning URL parameters');
        const url = new URL(window.location.href);
        const originalParams = Object.fromEntries(url.searchParams.entries());
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
        console.log('[AUTH DEBUG] URL cleaned:', {
          original: originalParams,
          cleaned: url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "")
        });

        console.log('[AUTH DEBUG] 🔄 Step 6: Redirecting to', next);
        console.log('[AUTH DEBUG] ===== OAuth Callback Completed Successfully =====');
        router.replace(next);
      } catch (error) {
        console.error('[AUTH DEBUG] ❌ CRITICAL ERROR: Unexpected error in OAuth callback', { 
          error,
          errorMessage: error?.message,
          errorStack: error?.stack,
          timestamp: new Date().toISOString()
        });
        router.replace("/sign-in?error=unexpected_error");
      }
    })().finally(() => {
      finished = true;
      clearTimeout(t);
      console.log('[AUTH DEBUG] Callback function completed, timeout cleared');
    });
  }, [router, sp]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
        <p className="text-xs text-gray-400 mt-2">Check console for detailed logs</p>
      </div>
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
