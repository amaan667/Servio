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
    }, 30000); // Increased timeout for mobile devices

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

      // Enhanced PKCE verifier check with multiple retry attempts
      const checkVerifier = () => {
        try {
          console.log('[AUTH DEBUG] callback: checking for PKCE verifier...');
          
          // Check for the specific Supabase PKCE verifier
          const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
          console.log('[AUTH DEBUG] callback: verifier from localStorage:', {
            hasVerifier: !!verifier,
            verifierLength: verifier?.length,
            verifierPreview: verifier ? `${verifier.substring(0, 10)}...` : null
          });
          
          // Check for any PKCE-related keys in localStorage
          const allLocalKeys = Object.keys(localStorage);
          const localPkceKeys = allLocalKeys.filter(k => k.includes("pkce") || k.includes("token-code-verifier") || k.includes("code_verifier"));
          console.log('[AUTH DEBUG] callback: localStorage PKCE-related keys:', localPkceKeys);
          
          // Check for any PKCE-related keys in sessionStorage
          const allSessionKeys = Object.keys(sessionStorage);
          const sessionPkceKeys = allSessionKeys.filter(k => k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier"));
          console.log('[AUTH DEBUG] callback: sessionStorage PKCE-related keys:', sessionPkceKeys);
          
          // Check for Supabase auth keys
          const supabaseKeys = allLocalKeys.filter(k => k.startsWith("sb-"));
          console.log('[AUTH DEBUG] callback: Supabase auth keys:', supabaseKeys);
          
          const hasVerifier = !!verifier;
          const hasLocalPkceKeys = localPkceKeys.length > 0;
          const hasSessionPkceKeys = sessionPkceKeys.length > 0;
          const hasSupabaseAuth = supabaseKeys.length > 0;
          
          console.log('[AUTH DEBUG] callback: verifier check summary', { 
            hasVerifier, 
            hasLocalPkceKeys,
            hasSessionPkceKeys,
            hasSupabaseAuth,
            timestamp: new Date().toISOString()
          });
          
          return hasVerifier || hasLocalPkceKeys || hasSessionPkceKeys || hasSupabaseAuth;
        } catch (err) { 
          console.log('[AUTH DEBUG] callback: verifier check failed', { error: err });
          return false; 
        }
      };

      // Enhanced retry mechanism for mobile browsers
      let hasVerifier = checkVerifier();
      let retryCount = 0;
      const maxRetries = 5;
      
      while (!hasVerifier && retryCount < maxRetries) {
        console.log(`[AUTH DEBUG] callback: verifier not found, retry ${retryCount + 1}/${maxRetries}...`);
        // Wait progressively longer for mobile browsers to sync storage
        await new Promise(resolve => setTimeout(resolve, 1000 + (retryCount * 500)));
        hasVerifier = checkVerifier();
        retryCount++;
      }
      
      if (!hasVerifier) {
        console.log('[AUTH DEBUG] callback: missing verifier after all retries - redirecting to sign-in with error');
        return router.replace("/sign-in?error=missing_verifier");
      }

      console.log('[AUTH DEBUG] callback: exchanging code for session');
      
      try {
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
        
        // Add a longer delay for mobile browsers to ensure session is properly set
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Clear OAuth progress flags
        sessionStorage.removeItem("sb_oauth_in_progress");
        sessionStorage.removeItem("sb_oauth_start_time");
        
        router.replace(next);
      } catch (exchangeError: any) {
        console.error('[AUTH DEBUG] callback: unexpected error during exchange', exchangeError);
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
