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
        console.log('[AUTH DEBUG] OAuth code detected, redirecting to auth callback');
        // Immediately redirect to auth callback instead of trying to handle it here
        const callbackUrl = `${getSiteUrl()}/auth/callback?${url.searchParams.toString()}`;
        window.location.href = callbackUrl;
        return;
      }
    })();
  }, [sb, router]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const redirectTo = `${getSiteUrl()}/auth/callback`;
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
