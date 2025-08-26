"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        console.log('[AUTH DEBUG] OAuth callback started');
        const supabase = createClient();
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.has("code");
        const hasError = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        console.log('[AUTH DEBUG] Callback params:', { 
          hasCode, 
          hasError, 
          errorDescription,
          fullUrl: window.location.href 
        });

        if (hasError) {
          console.error('[AUTH DEBUG] OAuth error in callback:', { hasError, errorDescription });
          setErrorMessage(errorDescription || 'Authentication failed');
          setStatus('error');
          setTimeout(() => router.replace("/sign-in?error=oauth_error"), 3000);
          return;
        }

        if (hasCode) {
          console.log('[AUTH DEBUG] Exchanging code for session');
          const { data, error } = await supabase.auth.exchangeCodeForSession({ 
            queryParams: url.searchParams 
          });
          
          if (error) {
            console.error('[AUTH DEBUG] Exchange error:', error);
            setErrorMessage('Failed to complete authentication');
            setStatus('error');
            setTimeout(() => router.replace("/sign-in?error=exchange_failed"), 3000);
            return;
          }

          console.log('[AUTH DEBUG] Session exchange successful:', { 
            hasUser: !!data.user, 
            userId: data.user?.id 
          });

          // Clean up URL
          url.searchParams.delete("code"); 
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
          
          setStatus('success');
          setTimeout(() => router.replace("/dashboard"), 1000);
        } else {
          console.log('[AUTH DEBUG] No code found in callback, redirecting to sign-in');
          router.replace("/sign-in?error=no_code");
        }
      } catch (error) {
        console.error('[AUTH DEBUG] Callback exception:', error);
        setErrorMessage('Unexpected error during authentication');
        setStatus('error');
        setTimeout(() => router.replace("/sign-in?error=callback_exception"), 3000);
      }
    })();
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Completing sign-in...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <p className="text-gray-600 mb-2">Authentication failed</p>
          <p className="text-sm text-gray-500">{errorMessage}</p>
          <p className="text-xs text-gray-400 mt-2">Redirecting to sign-in...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-green-500 text-2xl mb-2">✅</div>
          <p className="text-gray-600">Sign-in successful!</p>
          <p className="text-xs text-gray-400 mt-2">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
}
