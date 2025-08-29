"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { debugPKCEState } from "@/lib/supabase/client";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();
    
    console.log('[OAuth Frontend] callback: starting', { 
      url: window.location.href,
      searchParams: Object.fromEntries(sp.entries()),
      timestamp: new Date().toISOString()
    });

    // Debug PKCE state at callback start
    debugPKCEState();

    // Use consistent timeout for all platforms
    const timeoutDuration = 20000;
    const timeout = setTimeout(async () => {
      if (!finished) {
        console.log('[OAuth Frontend] callback: timeout reached', { timeoutDuration });
        try {
          await fetch('/api/auth/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'callback_timeout',
              url: window.location.href,
              searchParams: Object.fromEntries(sp.entries()),
            }),
          });
        } catch {}
        router.replace("/sign-in?error=timeout");
      }
    }, timeoutDuration);

    (async () => {
      // Step 1: Get the authorization code from URL parameters
      const code = sp.get("code");
      const errorParam = sp.get("error");
      const next = sp.get("next") || "/dashboard";

      console.log('[OAuth Frontend] callback: processing params', { 
        hasCode: !!code, 
        errorParam, 
        next,
        timestamp: new Date().toISOString()
      });

      if (errorParam) {
        console.log('[OAuth Frontend] callback: error param found', { errorParam });
        try {
          await fetch('/api/auth/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              event: 'oauth_error_param', 
              errorParam
            }) 
          });
        } catch {}
        return router.replace("/sign-in?error=oauth_error");
      }
      
      if (!code) {
        console.log('[OAuth Frontend] callback: no code found');
        try {
          await fetch('/api/auth/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              event: 'missing_code'
            }) 
          });
        } catch {}
        return router.replace("/sign-in?error=missing_code");
      }

      console.log('[OAuth Frontend] callback: using client-side exchange');
      
      try {
        // Step 3: Use client-side exchange to properly handle PKCE
        const { data, error } = await sb.auth.exchangeCodeForSession(code);
        
        // Scrub code/state to prevent repeat exchanges
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.searchParams}` : ""));
        } catch {}

        if (error) {
          console.log('[OAuth Frontend] callback: Client-side exchange failed', { 
            error: error.message
          });
          try {
            await fetch('/api/auth/log', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ 
                event: 'supabase_exchange_failed', 
                message: error.message
              }) 
            });
          } catch {}
          
          // Check if it's a PKCE verifier issue and provide specific error
          if (error.message.includes('code verifier') || error.message.includes('non-empty')) {
            return router.replace("/sign-in?error=pkce_error");
          }
          
          return router.replace("/sign-in?error=exchange_failed");
        }

        if (!data.session) {
          console.log('[OAuth Frontend] callback: no session after client-side exchange');
          try {
            await fetch('/api/auth/log', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ 
                event: 'no_session_after_exchange'
              }) 
            });
          } catch {}
          return router.replace("/sign-in?error=no_session");
        }

        console.log('[OAuth Frontend] callback: success, redirecting to', { 
          next, 
          userId: data.user.id
        });
        
        // Clear OAuth progress flags on success
        sessionStorage.removeItem("sb_oauth_in_progress");
        sessionStorage.removeItem("sb_oauth_start_time");
        
        // Use consistent delay for all platforms
        const sessionDelay = 500;
        await new Promise(resolve => setTimeout(resolve, sessionDelay));
        
        router.replace(next);
      } catch (exchangeError: any) {
        console.error('[OAuth Frontend] callback: unexpected error during exchange', { 
          error: exchangeError
        });
        try {
          await fetch('/api/auth/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              event: 'unexpected_exchange_error', 
              message: String(exchangeError?.message || exchangeError)
            }) 
          });
        } catch {}
        return router.replace("/sign-in?error=exchange_failed");
      }
    })().finally(() => { 
      finished = true; 
      clearTimeout(timeout); 
    });
  }, [router, sp]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Completing Sign In</h2>
        <p className="text-gray-600">Please wait while we complete your authentication...</p>
      </div>
    </div>
  );
}

export default function OAuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
        </div>
      </div>
    }>
      <OAuthCallbackContent />
    </Suspense>
  );
}
