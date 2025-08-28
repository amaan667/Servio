"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/sb-client";
import { getPkceVerifier } from '@/lib/auth/pkce-utils.js';

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let finished = false;
    const sb = createClient();
    
    // Initialize variables properly before use
    let authCode: string | null = null;
    let codeVerifier: string | null = null;
    
    console.log('[OAuth Frontend] callback: starting', { 
      url: window.location.href,
      searchParams: Object.fromEntries(sp.entries()),
      timestamp: new Date().toISOString()
    });

    const timeout = setTimeout(async () => {
      if (!finished) {
        console.log('[OAuth Frontend] callback: timeout reached');
        try {
          await fetch('/api/auth/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'callback_timeout',
              url: window.location.href,
              searchParams: Object.fromEntries(sp.entries()),
              userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
            }),
          });
        } catch {}
        router.replace("/sign-in?error=timeout");
      }
    }, 20000); // Increased timeout for mobile devices

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
          await fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'oauth_error_param', errorParam }) });
        } catch {}
        return router.replace("/sign-in?error=oauth_error");
      }
      
      if (!code) {
        console.log('[OAuth Frontend] callback: no code found');
        try {
          await fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'missing_code' }) });
        } catch {}
        return router.replace("/sign-in?error=missing_code");
      }

      // Step 2: Assign the authorization code
      authCode = code;
      console.log('[OAuth Frontend] callback: received authorization code', { 
        authCode: authCode ? `${authCode.substring(0, 10)}...` : null,
        authCodeLength: authCode?.length 
      });

      // Step 3: Enhanced PKCE verifier check with retry mechanism
      const checkVerifier = () => {
        try {
          console.log('[OAuth Frontend] callback: checking for PKCE verifier...');
          
          // Check for the specific Supabase PKCE verifier
          const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
          console.log('[OAuth Frontend] callback: verifier from localStorage:', {
            hasVerifier: !!verifier,
            verifierLength: verifier?.length,
            verifierPreview: verifier ? `${verifier.substring(0, 10)}...` : null
          });
          
          // Check for our custom PKCE verifier
          const customVerifier = getPkceVerifier();
          console.log('[OAuth Frontend] callback: custom verifier from sessionStorage:', {
            hasCustomVerifier: !!customVerifier,
            customVerifierLength: customVerifier?.length,
            customVerifierPreview: customVerifier ? `${customVerifier.substring(0, 10)}...` : null
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
            timestamp: new Date().toISOString()
          });
          
          return !!verifier || !!customVerifier || hasPkceKeys;
        } catch (err) { 
          console.log('[AUTH DEBUG] callback: verifier check failed', { error: err });
          return false; 
        }
      };

      // Retry mechanism for mobile browsers that might have delayed storage
      let hasVerifier = checkVerifier();
      if (!hasVerifier) {
        console.log('[OAuth Frontend] callback: verifier not found, retrying after delay...');
        // Wait a bit for mobile browsers to sync storage
        await new Promise(resolve => setTimeout(resolve, 1000));
        hasVerifier = checkVerifier();
      }
      
      if (!hasVerifier) {
        console.log('[OAuth Frontend] callback: missing verifier after retry - redirecting to sign-in with error');
        try {
          await fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'missing_verifier_after_retry' }) });
        } catch {}
        return router.replace("/sign-in?error=missing_verifier");
      }

      console.log('[OAuth Frontend] callback: exchanging code for session');
      
      try {
        // Step 4: Get the PKCE verifier from storage and assign it
        const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
        const customVerifier = getPkceVerifier();
        
        console.log('[OAuth Frontend] callback: PKCE verifier check', {
          hasVerifier: !!verifier,
          hasCustomVerifier: !!customVerifier,
          verifierLength: verifier?.length,
          customVerifierLength: customVerifier?.length,
        });

        // Assign the code verifier
        codeVerifier = verifier || customVerifier;
        
        if (!codeVerifier) {
          console.error('[OAuth Frontend] callback: No PKCE verifier found');
          try {
            await fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'missing_verifier_for_exchange' }) });
          } catch {}
          return router.replace("/sign-in?error=missing_verifier");
        }

        // Step 5: Validate both variables have valid string values before exchange
        if (!authCode || !codeVerifier) {
          console.error('[OAuth Frontend] callback: Auth code or code verifier not ready', {
            hasAuthCode: !!authCode,
            hasCodeVerifier: !!codeVerifier,
            authCodeType: typeof authCode,
            codeVerifierType: typeof codeVerifier
          });
          try {
            await fetch('/api/auth/log', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ 
                event: 'variables_not_ready',
                hasAuthCode: !!authCode,
                hasCodeVerifier: !!codeVerifier
              }) 
            });
          } catch {}
          return router.replace("/sign-in?error=variables_not_ready");
        }

        // Step 6: Log the payload before sending
        console.log('[OAuth Frontend] callback: Sending PKCE exchange request', {
          authCode: authCode ? `${authCode.substring(0, 10)}...` : null,
          codeVerifier: codeVerifier ? `${codeVerifier.substring(0, 10)}...` : null,
          payloadShape: { code: 'string', code_verifier: 'string', redirect_uri: 'string' }
        });

        // Get the redirect_uri that was used in the original OAuth request
        const redirectUri = `${window.location.origin}/auth/callback`;

        // Step 7: Call the PKCE exchange only after both variables are ready
        const exchangeResponse = await fetch('/api/auth/supabase-pkce', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            code: authCode, 
            code_verifier: codeVerifier,
            redirect_uri: redirectUri
          })
        });

        const exchangeData = await exchangeResponse.json();
        
        console.log('[OAuth Frontend] callback: PKCE exchange response', {
          status: exchangeResponse.status,
          ok: exchangeResponse.ok,
          hasError: !!exchangeData.error,
          error: exchangeData.error,
          hasAccessToken: !!exchangeData.access_token,
          hasUser: !!exchangeData.user,
        });

        if (!exchangeResponse.ok || exchangeData.error) {
          console.log('[OAuth Frontend] callback: PKCE exchange failed', { 
            error: exchangeData.error, 
            errorDescription: exchangeData.error_description 
          });
          try {
            await fetch('/api/auth/log', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ 
                event: 'pkce_exchange_failed', 
                error: exchangeData.error,
                errorDescription: exchangeData.error_description 
              }) 
            });
          } catch {}
          return router.replace("/sign-in?error=pkce_exchange_failed");
        }

        // Now use Supabase's exchangeCodeForSession to complete the flow
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
          console.log('[OAuth Frontend] callback: Supabase exchange failed', { error: error.message });
          try {
            await fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'supabase_exchange_failed', message: error.message }) });
          } catch {}
          return router.replace("/sign-in?error=exchange_failed");
        }

        console.log('[OAuth Frontend] callback: getting session');
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
          console.log('[OAuth Frontend] callback: no session after exchange');
          try {
            await fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'no_session_after_exchange' }) });
          } catch {}
          return router.replace("/sign-in?error=no_session");
        }

        console.log('[OAuth Frontend] callback: success, redirecting to', { next, userId: session.user.id });
        
        // Add a small delay for mobile browsers to ensure session is properly set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        router.replace(next);
      } catch (exchangeError: any) {
        console.error('[OAuth Frontend] callback: unexpected error during exchange', exchangeError);
        try {
          await fetch('/api/auth/log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'unexpected_exchange_error', message: String(exchangeError?.message || exchangeError) }) });
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
