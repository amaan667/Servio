"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();

    const timeout = setTimeout(() => {
      if (!finished) {
        console.log('[AUTH DEBUG] OAuth callback timeout');
        router.replace("/sign-in?error=timeout");
      }
    }, 30000); // Increased timeout to 30 seconds

    (async () => {
      try {
        console.log('[AUTH DEBUG] ===== OAuth Callback Started =====');
        console.log('[AUTH DEBUG] URL params:', Object.fromEntries(sp.entries()));
        
        const err = sp.get("error");
        const code = sp.get("code");
        const next = sp.get("next") || "/dashboard";
        
        if (err) {
          console.log('[AUTH DEBUG] ❌ OAuth error from provider:', err);
          return router.replace(`/sign-in?error=oauth_error&message=${encodeURIComponent(err)}`);
        }
        
        if (!code) {
          console.log('[AUTH DEBUG] ❌ No authentication code received');
          return router.replace("/sign-in?error=missing_code");
        }

        console.log('[AUTH DEBUG] 🔄 Exchanging code for session...');
        
        // 1) Exchange PKCE code on the **client**
        const { data, error } = await sb.auth.exchangeCodeForSession({
          queryParams: new URLSearchParams(window.location.search),
        });

        console.log('[AUTH DEBUG] Exchange result:', {
          hasData: !!data,
          hasSession: !!data?.session,
          hasUser: !!data?.user,
          error: error?.message
        });

        // 2) Clean URL so refresh/back doesn't retry
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

        if (error) {
          console.log('[AUTH DEBUG] ❌ Exchange failed:', error.message);
          
          // If we got a verifier mismatch, clear stale storage and restart once
          if (error.message.includes('PKCE') || error.message.includes('verifier')) {
            console.log('[AUTH DEBUG] 🔄 Clearing stale PKCE data and restarting OAuth');
            try {
              Object.keys(localStorage).forEach(k => {
                if (k.startsWith("sb-") || k.includes("pkce")) {
                  console.log('[AUTH DEBUG] Removing key:', k);
                  localStorage.removeItem(k);
                }
              });
            } catch (clearError) {
              console.log('[AUTH DEBUG] ❌ Failed to clear localStorage:', clearError);
            }
            
            const origin = window.location.origin;
            await sb.auth.signInWithOAuth({
              provider: "google",
              options: { 
                flowType: "pkce", 
                redirectTo: `${origin}/auth/callback`,
                queryParams: { prompt: 'select_account' }
              },
            });
            return; // navigates away
          }
          
          // For other errors, redirect to sign-in with error
          return router.replace(`/sign-in?error=exchange_failed&message=${encodeURIComponent(error.message)}`);
        }

        if (!data?.session) {
          console.log('[AUTH DEBUG] ❌ No session after exchange');
          return router.replace("/sign-in?error=no_session");
        }

        console.log('[AUTH DEBUG] ✅ OAuth successful, redirecting to:', next);
        router.replace(next);
        
      } catch (error: any) {
        console.log('[AUTH DEBUG] ❌ Unexpected error in OAuth callback:', error);
        router.replace(`/sign-in?error=unexpected_error&message=${encodeURIComponent(error.message || 'Unknown error')}`);
      } finally {
        finished = true;
        clearTimeout(timeout);
        console.log('[AUTH DEBUG] ===== OAuth Callback Completed =====');
      }
    })();
  }, [router, sp]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
