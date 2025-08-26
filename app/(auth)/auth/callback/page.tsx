"use client";
import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearAuthStorage } from "@/lib/sb-client";

export const dynamic = "force-dynamic";

function OAuthCallbackContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

  useEffect(() => {
    console.log('[AUTH DEBUG] OAuth callback component mounted');
    console.log('[AUTH DEBUG] Current URL:', window.location.href);
    console.log('[AUTH DEBUG] Search params:', Object.fromEntries(sp.entries()));
    
    let finished = false;
    const sb = createClient();
    console.log('[AUTH DEBUG] Supabase client created in callback');

    // Increased timeout to 45 seconds for better reliability
    const timeout = setTimeout(() => {
      if (!finished) {
        console.log('[AUTH DEBUG] OAuth callback timeout after 45 seconds');
        setDebugInfo("Timeout after 45 seconds");
        router.replace("/sign-in?error=timeout&message=Authentication timed out. Please try again.");
      }
    }, 45000);

    (async () => {
      try {
        setDebugInfo("Starting OAuth callback...");
        console.log('[AUTH DEBUG] ===== OAuth Callback Started =====');
        console.log('[AUTH DEBUG] URL params:', Object.fromEntries(sp.entries()));
        console.log('[AUTH DEBUG] Current URL:', window.location.href);
        
        const err = sp.get("error");
        const code = sp.get("code");
        const state = sp.get("state");
        const next = sp.get("next") || "/dashboard";
        
        // Log all parameters for debugging
        console.log('[AUTH DEBUG] Parsed parameters:', {
          error: err,
          hasCode: !!code,
          codeLength: code?.length,
          hasState: !!state,
          next: next
        });
        
        if (err) {
          console.log('[AUTH DEBUG] ❌ OAuth error from provider:', err);
          setDebugInfo(`OAuth error: ${err}`);
          return router.replace(`/sign-in?error=oauth_error&message=${encodeURIComponent(err)}`);
        }
        
        if (!code) {
          console.log('[AUTH DEBUG] ❌ No authentication code received');
          console.log('[AUTH DEBUG] Available parameters:', Array.from(sp.entries()));
          setDebugInfo("No authentication code received");
          
          // Check if we have any other auth-related parameters
          const hasAuthParams = Array.from(sp.entries()).some(([key]) => 
            key.includes('auth') || key.includes('token') || key.includes('session')
          );
          
          if (hasAuthParams) {
            console.log('[AUTH DEBUG] Found other auth parameters, attempting to process');
            setDebugInfo("Found other auth parameters, attempting to process");
            // Try to process with available parameters
          } else {
            return router.replace("/sign-in?error=missing_code&message=No authentication code received from provider");
          }
        }

        setDebugInfo("Exchanging code for session...");
        console.log('[AUTH DEBUG] 🔄 Exchanging code for session...');
        
        // Clear any stale auth state before exchange
        clearAuthStorage();
        
        // 1) Exchange PKCE code on the **client**
        const exchangeStartTime = Date.now();
        const { data, error } = await sb.auth.exchangeCodeForSession({
          queryParams: new URLSearchParams(window.location.search),
        });
        const exchangeTime = Date.now() - exchangeStartTime;

        console.log('[AUTH DEBUG] Exchange completed in', exchangeTime, 'ms');
        console.log('[AUTH DEBUG] Exchange result:', {
          hasData: !!data,
          hasSession: !!data?.session,
          hasUser: !!data?.user,
          error: error?.message,
          errorCode: error?.status
        });

        // 2) Clean URL so refresh/back doesn't retry
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        url.searchParams.delete("error");
        url.searchParams.delete("error_description");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));

        if (error) {
          console.log('[AUTH DEBUG] ❌ Exchange failed:', {
            message: error.message,
            status: error.status,
            exchangeTime
          });
          setDebugInfo(`Exchange failed: ${error.message}`);
          
          // Handle specific error cases
          if (error.message.includes('PKCE') || error.message.includes('verifier') || error.message.includes('code_verifier')) {
            console.log('[AUTH DEBUG] 🔄 PKCE/verifier mismatch detected, clearing stale data and restarting OAuth');
            setDebugInfo("PKCE mismatch, restarting OAuth...");
            clearAuthStorage();
            
            // Restart OAuth flow
            const origin = window.location.origin;
            console.log('[AUTH DEBUG] Restarting OAuth with origin:', origin);
            
            const { data: oauthData, error: oauthError } = await sb.auth.signInWithOAuth({
              provider: "google",
              options: { 
                flowType: "pkce", 
                redirectTo: `${origin}/auth/callback`,
                queryParams: { prompt: 'select_account' }
              },
            });
            
            if (oauthError) {
              console.log('[AUTH DEBUG] ❌ OAuth restart failed:', oauthError.message);
              setDebugInfo(`OAuth restart failed: ${oauthError.message}`);
              return router.replace(`/sign-in?error=oauth_restart_failed&message=${encodeURIComponent(oauthError.message)}`);
            }
            
            console.log('[AUTH DEBUG] ✅ OAuth restart successful, redirecting to Google');
            setDebugInfo("OAuth restart successful, redirecting...");
            return; // navigates away
          }
          
          // For other errors, redirect to sign-in with error
          return router.replace(`/sign-in?error=exchange_failed&message=${encodeURIComponent(error.message)}`);
        }

        if (!data?.session) {
          console.log('[AUTH DEBUG] ❌ No session after exchange');
          setDebugInfo("No session after exchange");
          return router.replace("/sign-in?error=no_session&message=Authentication completed but no session was created");
        }

        console.log('[AUTH DEBUG] ✅ OAuth successful, session created:', {
          userId: data.session.user?.id,
          userEmail: data.session.user?.email,
          expiresAt: data.session.expires_at
        });
        setDebugInfo("Session created, verifying...");
        
        // Verify session is properly set
        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData.session) {
          console.log('[AUTH DEBUG] ❌ Session verification failed');
          setDebugInfo("Session verification failed");
          return router.replace("/sign-in?error=session_verification_failed&message=Session was not properly established");
        }
        
        console.log('[AUTH DEBUG] ✅ Session verified, redirecting to:', next);
        setDebugInfo(`Redirecting to ${next}...`);
        router.replace(next);
        
      } catch (error: any) {
        console.log('[AUTH DEBUG] ❌ Unexpected error in OAuth callback:', {
          message: error?.message,
          stack: error?.stack,
          name: error?.name
        });
        setDebugInfo(`Unexpected error: ${error?.message}`);
        router.replace(`/sign-in?error=unexpected_error&message=${encodeURIComponent(error.message || 'Unknown error occurred during authentication')}`);
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
        <p className="mt-1 text-xs text-gray-500">This may take a few moments</p>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-2 text-xs text-gray-400">Debug: {debugInfo}</p>
        )}
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
