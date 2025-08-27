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
        
        // Try to exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.log('[AUTH DEBUG] Exchange error in client callback:', exchangeError);
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
