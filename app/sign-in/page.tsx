'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import SignInForm from './signin-form';

function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function SignInPageContent() {
  const sb = useMemo(() => createClient(), []);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle OAuth code exchange on page load
  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const hasCode = url.searchParams.has("code");
      const hasError = url.searchParams.get("error");

      console.log('[AUTH DEBUG] Sign-in page loaded with:', {
        hasCode,
        hasError,
        url: window.location.href
      });

      if (hasCode && !hasError) {
        console.log('[AUTH DEBUG] Exchanging OAuth code for session');
        setLoading(true);
        
        // Add a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('[AUTH DEBUG] OAuth code exchange timed out');
          setError('Authentication timed out. Please try again.');
          setLoading(false);
        }, 10000); // 10 second timeout
        
        try {
          // First, try to get the current session to see if we're already authenticated
          const { data: sessionData } = await sb.auth.getSession();
          if (sessionData.session) {
            console.log('[AUTH DEBUG] Session already exists, redirecting to dashboard');
            clearTimeout(timeoutId);
            router.replace("/dashboard");
            return;
          }

          const { data, error } = await sb.auth.exchangeCodeForSession({
            queryParams: url.searchParams,
          });
          
          clearTimeout(timeoutId);
          
          // Clean the URL
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
          window.history.replaceState({}, "", clean);

          if (error) {
            console.error('[AUTH DEBUG] exchangeCodeForSession failed:', error);
            setError(error.message || 'Authentication failed. Please try again.');
            setLoading(false);
          } else if (data.session) {
            console.log('[AUTH DEBUG] OAuth session exchange successful, redirecting to dashboard');
            router.replace("/dashboard");
          } else {
            console.error('[AUTH DEBUG] No session returned from exchangeCodeForSession');
            setError('Authentication failed. No session returned.');
            setLoading(false);
          }
        } catch (e: any) {
          clearTimeout(timeoutId);
          console.error('[AUTH DEBUG] exchangeCodeForSession threw exception:', e);
          setError('Authentication failed. Please try again.');
          setLoading(false);
        }
      }
    })();
  }, [sb, router]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const redirectTo = `${getSiteUrl()}/sign-in`;
      console.log('[AUTH DEBUG] Starting Google OAuth redirect to:', redirectTo);
      
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });
      
      if (error) {
        console.error('[AUTH DEBUG] Google redirect start failed:', error);
        throw new Error(error.message || 'Could not start Google sign-in');
      }
      
      console.log('[AUTH DEBUG] Google OAuth redirect initiated successfully');
      // The browser will navigate away in the OAuth flow
    } catch (e: any) {
      console.error('[AUTH DEBUG] Google sign-in threw:', e);
      setError(e?.message ?? "Sign-in failed");
      setLoading(false);
    }
  };

  return (
    <SignInForm 
      onGoogleSignIn={signInWithGoogle} 
      loading={loading} 
      error={error}
      setError={setError}
    />
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  );
}
