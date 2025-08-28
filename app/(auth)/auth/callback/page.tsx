"use client";
export const dynamic = "force-dynamic";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/sb-client";
import { getPkceVerifier } from '@/lib/auth/pkce-utils.js';
import { handleGoogleCallback } from '@/lib/auth/signin';

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
    }, 20000); // Increased timeout for mobile devices

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

      // Call our custom PKCE callback handler for debugging
      console.log('[AUTH DEBUG] callback: calling custom PKCE handler...');
      try {
        await handleGoogleCallback(code);
        console.log('[AUTH DEBUG] callback: custom PKCE handler completed');
      } catch (pkceError) {
        console.error('[AUTH DEBUG] callback: custom PKCE handler failed:', pkceError);
      }

      // Enhanced PKCE verifier check with retry mechanism
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
          
          // Check for our custom PKCE verifier
          const customVerifier = getPkceVerifier();
          console.log('[AUTH DEBUG] callback: custom verifier from sessionStorage:', {
            hasCustomVerifier: !!customVerifier,
            customVerifierLength: customVerifier?.length,
            customVerifierPreview: customVerifier ? `${customVerifier.substring(0, 10)}...` : null
          });
          
          // Check for any PKCE-related keys
          const allKeys = Object.keys(localStorage);
          const pkceKeys = allKeys.filter(k => k.includes("pkce") || k.includes("token-code-verifier") || k.includes("code_verifier"));
          console.log('[AUTH DEBUG] callback: all PKCE-related keys:', pkceKeys);
          
          // Check for Supabase auth keys
          const supabaseKeys = allKeys.filter(k => k.startsWith("sb-"));
          console.log('[AUTH DEBUG] callback: Supabase auth keys:', supabaseKeys);
          
          // Check for custom PKCE keys in sessionStorage
          const sessionKeys = Object.keys(sessionStorage);
          const customPkceKeys = sessionKeys.filter(k => k.includes("pkce_verifier"));
          console.log('[AUTH DEBUG] callback: custom PKCE keys in sessionStorage:', customPkceKeys);
          
          const hasPkceKeys = pkceKeys.length > 0;
          const hasSupabaseAuth = supabaseKeys.length > 0;
          const hasCustomPkceKeys = customPkceKeys.length > 0;
          
          console.log('[AUTH DEBUG] callback: verifier check summary', { 
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
        console.log('[AUTH DEBUG] callback: verifier not found, retrying after delay...');
        // Wait a bit for mobile browsers to sync storage
        await new Promise(resolve => setTimeout(resolve, 1000));
        hasVerifier = checkVerifier();
      }
      
      if (!hasVerifier) {
        console.log('[AUTH DEBUG] callback: missing verifier after retry - redirecting to sign-in with error');
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
        
        // Add a small delay for mobile browsers to ensure session is properly set
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
