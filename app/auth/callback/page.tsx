"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OAuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        console.log('[AUTH DEBUG] OAuth callback started');
        
        const hasErr = sp.get("error");
        const hasCode = !!sp.get("code");
        
        console.log('[AUTH DEBUG] Callback params:', { 
          hasCode, 
          hasError: !!hasErr,
          fullUrl: window.location.href,
          allParams: Object.fromEntries(sp.entries())
        });

        if (hasErr) {
          console.error('[AUTH DEBUG] OAuth error in callback:', { hasErr });
          setErrorMessage('Authentication failed');
          setStatus('error');
          setTimeout(() => router.replace("/sign-in?error=oauth_error"), 3000);
          return;
        }

        if (!hasCode) {
          console.log('[AUTH DEBUG] No code found in callback, redirecting to sign-in');
          setErrorMessage('No authorization code received');
          setStatus('error');
          setTimeout(() => router.replace("/sign-in?error=missing_code"), 3000);
          return;
        }

        console.log('[AUTH DEBUG] Exchanging code for session');
        
        // Add timeout to prevent hanging - increased to 30 seconds
        const exchangePromise = createClient().auth.exchangeCodeForSession({
          queryParams: new URLSearchParams(window.location.search),
        });
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Exchange timeout after 30 seconds')), 30000);
        });
        
        const { data, error } = await Promise.race([exchangePromise, timeoutPromise]) as any;
        
        if (error) {
          console.error('[AUTH DEBUG] Exchange error:', {
            message: error.message,
            status: error.status,
            name: error.name,
            stack: error.stack
          });
          
          // Retry logic for certain types of errors
          if (retryCount < 2 && (
            error.message?.includes('timeout') || 
            error.message?.includes('network') ||
            error.status === 408 ||
            error.status === 500 ||
            error.status === 502 ||
            error.status === 503 ||
            error.status === 504
          )) {
            console.log('[AUTH DEBUG] Retrying exchange, attempt:', retryCount + 1);
            setRetryCount(prev => prev + 1);
            // Wait 2 seconds before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Recursive call to retry
            return;
          }
          
          setErrorMessage(error.message || 'Failed to complete authentication');
          setStatus('error');
          setTimeout(() => router.replace(`/sign-in?error=exchange_failed&message=${encodeURIComponent(error.message)}`), 3000);
          return;
        }

        console.log('[AUTH DEBUG] Session exchange successful:', { 
          hasUser: !!data?.user, 
          userId: data?.user?.id,
          hasSession: !!data?.session,
          sessionExpiresAt: data?.session?.expires_at
        });

        // Clean the query so refresh/back doesn't retry
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ""));
        
        setStatus('success');
        setTimeout(() => router.replace("/dashboard"), 1000);
      } catch (error: any) {
        console.error('[AUTH DEBUG] Callback exception:', {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
          cause: error?.cause
        });
        
        // Retry logic for timeout errors
        if (retryCount < 2 && error?.message?.includes('timeout')) {
          console.log('[AUTH DEBUG] Retrying after timeout, attempt:', retryCount + 1);
          setRetryCount(prev => prev + 1);
          // Wait 3 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 3000));
          // Recursive call to retry
          return;
        }
        
        // Provide more specific error messages based on the error type
        let userMessage = 'Unexpected error during authentication';
        let errorCode = 'callback_exception';
        
        if (error?.message?.includes('timeout')) {
          userMessage = 'Authentication timed out. Please try again.';
          errorCode = 'timeout';
        } else if (error?.message?.includes('network')) {
          userMessage = 'Network error. Please check your connection and try again.';
          errorCode = 'network_error';
        } else if (error?.message?.includes('fetch')) {
          userMessage = 'Connection error. Please try again.';
          errorCode = 'fetch_error';
        }
        
        setErrorMessage(userMessage);
        setStatus('error');
        setTimeout(() => router.replace(`/sign-in?error=${errorCode}&message=${encodeURIComponent(userMessage)}`), 3000);
      }
    })();
  }, [router, sp, retryCount]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Completing sign-in...</p>
          <p className="text-xs text-gray-400 mt-1">
            {retryCount > 0 ? `Retry attempt ${retryCount}/2` : 'This may take a few seconds'}
          </p>
          {retryCount > 0 && (
            <p className="text-xs text-gray-400 mt-1">Please wait while we retry...</p>
          )}
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
