"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/sb-client";
import { getPkceVerifier } from '@/lib/auth/pkce-utils.js';

// Enhanced mobile detection
function isMobileBrowser() {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
}

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();
    const isMobile = isMobileBrowser();
    
    console.log('[OAuth Frontend] callback: starting', { 
      url: window.location.href,
      searchParams: Object.fromEntries(sp.entries()),
      isMobile,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      timestamp: new Date().toISOString()
    });

    // Enhanced timeout for mobile devices - they need more time for storage operations
    const timeoutDuration = isMobile ? 30000 : 20000;
    const timeout = setTimeout(async () => {
      if (!finished) {
        console.log('[OAuth Frontend] callback: timeout reached', { isMobile, timeoutDuration });
        try {
          await fetch('/api/auth/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'callback_timeout',
              url: window.location.href,
              searchParams: Object.fromEntries(sp.entries()),
              isMobile,
              userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
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
        isMobile,
        timestamp: new Date().toISOString()
      });

      if (errorParam) {
        console.log('[OAuth Frontend] callback: error param found', { errorParam, isMobile });
        try {
          await fetch('/api/auth/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              event: 'oauth_error_param', 
              errorParam,
              isMobile 
            }) 
          });
        } catch {}
        return router.replace("/sign-in?error=oauth_error");
      }
      
      if (!code) {
        console.log('[OAuth Frontend] callback: no code found', { isMobile });
        try {
          await fetch('/api/auth/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              event: 'missing_code',
              isMobile 
            }) 
          });
        } catch {}
        return router.replace("/sign-in?error=missing_code");
      }

      // Step 2: Enhanced PKCE verifier check with mobile-specific retry mechanism
      const checkVerifier = () => {
        try {
          console.log('[OAuth Frontend] callback: checking for PKCE verifier...', { isMobile });
          
          // Check for the specific Supabase PKCE verifier
          const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
          console.log('[OAuth Frontend] callback: verifier from localStorage:', {
            hasVerifier: !!verifier,
            verifierLength: verifier?.length,
            verifierPreview: verifier ? `${verifier.substring(0, 10)}...` : null,
            isMobile
          });
          
          // Check for our custom PKCE verifier
          const customVerifier = getPkceVerifier();
          console.log('[OAuth Frontend] callback: custom verifier from sessionStorage:', {
            hasCustomVerifier: !!customVerifier,
            customVerifierLength: customVerifier?.length,
            customVerifierPreview: customVerifier ? `${customVerifier.substring(0, 10)}...` : null,
            isMobile
          });
          
          // Check for any PKCE-related keys
          const allKeys = Object.keys(localStorage);
          const pkceKeys = allKeys.filter(k => k.includes("pkce") || k.includes("token-code-verifier") || k.includes("code_verifier"));
          console.log('[OAuth Frontend] callback: all PKCE-related keys:', pkceKeys);
          
          // Check for Supabase auth keys
          const supabaseKeys = allKeys.filter(k => k.startsWith("sb-"));
          console.log('[OAuth Frontend] callback: Supabase auth keys:', supabaseKeys);
          
          // Check for custom PKCE keys in sessionStorage
          const sessionKeys = Object.keys(sessionStorage);
          const customPkceKeys = sessionKeys.filter(k => k.includes("pkce_verifier"));
          console.log('[OAuth Frontend] callback: custom PKCE keys in sessionStorage:', customPkceKeys);
          
          const hasPkceKeys = pkceKeys.length > 0;
          const hasSupabaseAuth = supabaseKeys.length > 0;
          const hasCustomPkceKeys = customPkceKeys.length > 0;
          
          console.log('[OAuth Frontend] callback: verifier check summary', { 
            hasVerifier: !!verifier, 
            hasCustomVerifier: !!customVerifier,
            hasPkceKeys,
            hasCustomPkceKeys,
            hasSupabaseAuth,
            isMobile,
            timestamp: new Date().toISOString()
          });
          
          // On mobile, be more lenient with verifier checks
          if (isMobile) {
            const hasAnyPkceData = !!verifier || !!customVerifier || hasPkceKeys || hasSupabaseAuth;
            console.log('[OAuth Frontend] callback: mobile verifier check result', { hasAnyPkceData });
            return hasAnyPkceData;
          }
          
          return !!verifier || !!customVerifier || hasPkceKeys;
        } catch (err) { 
          console.log('[AUTH DEBUG] callback: verifier check failed', { error: err, isMobile });
          // On mobile, don't fail immediately if verifier check fails
          return isMobile;
        }
      };

      // Enhanced retry mechanism for mobile browsers
      let hasVerifier = checkVerifier();
      if (!hasVerifier) {
        console.log('[OAuth Frontend] callback: verifier not found, retrying after delay...', { isMobile });
        
        // Mobile browsers need longer delays for storage sync
        const retryDelay = isMobile ? 2000 : 1000;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        hasVerifier = checkVerifier();
        
        // On mobile, try one more time if still no verifier
        if (!hasVerifier && isMobile) {
          console.log('[OAuth Frontend] callback: second retry for mobile...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          hasVerifier = checkVerifier();
        }
      }
      
      if (!hasVerifier) {
        console.log('[OAuth Frontend] callback: missing verifier after retry - redirecting to sign-in with error', { isMobile });
        try {
          await fetch('/api/auth/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              event: 'missing_verifier_after_retry',
              isMobile 
            }) 
          });
        } catch {}
        return router.replace("/sign-in?error=missing_verifier");
      }

      console.log('[OAuth Frontend] callback: using Supabase exchangeCodeForSession', { isMobile });
      
      try {
        // Step 3: Use Supabase's built-in exchangeCodeForSession method
        // This method automatically handles PKCE exchange with the correct payload structure
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
          console.log('[OAuth Frontend] callback: Supabase exchange failed', { 
            error: error.message,
            isMobile 
          });
          try {
            await fetch('/api/auth/log', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ 
                event: 'supabase_exchange_failed', 
                message: error.message,
                isMobile 
              }) 
            });
          } catch {}
          return router.replace("/sign-in?error=exchange_failed");
        }

        console.log('[OAuth Frontend] callback: getting session', { isMobile });
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
          console.log('[OAuth Frontend] callback: no session after exchange', { isMobile });
          try {
            await fetch('/api/auth/log', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ 
                event: 'no_session_after_exchange',
                isMobile 
              }) 
            });
          } catch {}
          return router.replace("/sign-in?error=no_session");
        }

        console.log('[OAuth Frontend] callback: success, redirecting to', { 
          next, 
          userId: session.user.id,
          isMobile 
        });
        
        // Enhanced delay for mobile browsers to ensure session is properly set
        const sessionDelay = isMobile ? 1000 : 500;
        await new Promise(resolve => setTimeout(resolve, sessionDelay));
        
        router.replace(next);
      } catch (exchangeError: any) {
        console.error('[OAuth Frontend] callback: unexpected error during exchange', { 
          error: exchangeError,
          isMobile 
        });
        try {
          await fetch('/api/auth/log', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
              event: 'unexpected_exchange_error', 
              message: String(exchangeError?.message || exchangeError),
              isMobile 
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
