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

    console.log('[AUTH DEBUG] OAuth callback started', { 
      hasError: !!sp.get("error"), 
      hasCode: !!sp.get("code"),
      hasNext: !!sp.get("next")
    });

    // Increased timeout to 30 seconds to avoid "Authentication timed out"
    const t = setTimeout(() => {
      if (!finished) {
        console.log('[AUTH DEBUG] OAuth callback timeout - redirecting to sign-in');
        router.replace("/sign-in?error=timeout");
      }
    }, 30000);

    (async () => {
      try {
        const err = sp.get("error");
        const code = sp.get("code");
        const next = sp.get("next") || "/dashboard";

        if (err) {
          console.log('[AUTH DEBUG] OAuth error detected', { error: err });
          return router.replace("/sign-in?error=oauth_error");
        }
        
        if (!code) {
          console.log('[AUTH DEBUG] No code parameter found');
          return router.replace("/sign-in?error=missing_code");
        }

        console.log('[AUTH DEBUG] Starting code exchange');
        const qp = new URLSearchParams(window.location.search);

        // 1) Normal PKCE exchange in browser
        let { error, data } = await sb.auth.exchangeCodeForSession({ queryParams: qp });

        if (error) {
          console.log('[AUTH DEBUG] Code exchange failed', { error: error.message });
          
          // 2) If verifier missing/mismatch, clear stale state and restart once
          try {
            console.log('[AUTH DEBUG] Clearing stale auth state and retrying');
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
            });
          } catch (clearError) {
            console.log('[AUTH DEBUG] Error clearing localStorage', { error: clearError });
          }
          
          const origin = window.location.origin;
          console.log('[AUTH DEBUG] Restarting OAuth flow', { origin });
          
          await sb.auth.signInWithOAuth({
            provider: "google",
            options: { flowType: "pkce", redirectTo: `${origin}/auth/callback` },
          });
          return; // browser navigates away
        }

        console.log('[AUTH DEBUG] Code exchange successful', { 
          hasSession: !!data.session,
          userId: data.session?.user?.id 
        });

        // 3) Clean URL (avoid re-exchange on back/refresh)
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

        console.log('[AUTH DEBUG] Redirecting to', next);
        router.replace(next);
      } catch (error) {
        console.error('[AUTH DEBUG] Unexpected error in OAuth callback', { error });
        router.replace("/sign-in?error=unexpected_error");
      }
    })().finally(() => {
      finished = true;
      clearTimeout(t);
    });
  }, [router, sp]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
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
