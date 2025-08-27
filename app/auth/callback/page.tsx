"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/sb-client";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing authentication...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AUTH DEBUG] Client-side callback fallback triggered');
        console.log('[AUTH DEBUG] URL params:', searchParams ? Object.fromEntries(searchParams.entries()) : 'null');
        
        const code = searchParams?.get('code');
        const error = searchParams?.get('error');
        
        if (error) {
          console.log('[AUTH DEBUG] OAuth error in client callback:', error);
          router.replace(`/sign-in?error=oauth_error&message=${encodeURIComponent(error)}`);
          return;
        }
        
        if (!code) {
          console.log('[AUTH DEBUG] No code in client callback');
          router.replace('/sign-in?error=missing_code&message=No authentication code received');
          return;
        }
        
        setStatus("Exchanging code for session...");
        
        // Check for PKCE state before exchange
        console.log('[AUTH DEBUG] Checking PKCE state before exchange...');
        const localStorageKeys = Object.keys(localStorage).filter(k => 
          k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
        );
        const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
          k.includes("pkce") || k.includes("verifier") || k.includes("code_verifier") || k.startsWith("sb-")
        );
        console.log('[AUTH DEBUG] PKCE localStorage keys:', localStorageKeys);
        console.log('[AUTH DEBUG] PKCE sessionStorage keys:', sessionStorageKeys);
        
        // Try to exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.log('[AUTH DEBUG] Exchange error in client callback:', exchangeError);
          
          // Handle specific PKCE error
          if (exchangeError.message.includes('code verifier should be non-empty') || 
              exchangeError.message.includes('both auth code and code verifier should be non-empty')) {
            console.log('[AUTH DEBUG] PKCE error detected - clearing storage and redirecting');
            // Clear all auth storage and redirect to sign-in
            localStorage.clear();
            sessionStorage.clear();
            router.replace('/sign-in?error=pkce_failed&message=Authentication flow interrupted. Please try signing in again.');
            return;
          }
          
          router.replace(`/sign-in?error=exchange_failed&message=${encodeURIComponent(exchangeError.message)}`);
          return;
        }
        
        if (!data.session) {
          console.log('[AUTH DEBUG] No session in client callback');
          router.replace('/sign-in?error=no_session&message=No session created');
          return;
        }
        
        console.log('[AUTH DEBUG] Client callback successful, redirecting to dashboard');
        setStatus("Authentication successful! Redirecting...");
        router.replace('/dashboard');
        
      } catch (error: any) {
        console.log('[AUTH DEBUG] Unexpected error in client callback:', error);
        router.replace(`/sign-in?error=unexpected_error&message=${encodeURIComponent(error.message || 'Unknown error')}`);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600 mb-2">Completing sign in...</p>
        <p className="text-sm text-gray-500">{status}</p>
        <p className="text-xs text-gray-400 mt-2">This may take a few moments</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 mb-2">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
