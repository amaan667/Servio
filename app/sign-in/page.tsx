'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getAuthRedirectUrl } from '@/lib/auth';
import SignInForm from './signin-form';

function SignInPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      // Check if user is already signed in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // show form

      // If already signed in, redirect to dashboard
      console.log('[SIGN-IN] User already signed in, redirecting to dashboard');
      router.replace('/dashboard');
    };
    run();
  }, [router, sp]);

  const signInWithGoogle = async () => {
    const redirectUrl = (() => {
      // Use the current origin for local development, Railway URL for production
      if (typeof window !== 'undefined') {
        const currentOrigin = window.location.origin;
        console.log('[SIGN-IN] Current origin:', currentOrigin);
        
        // If we're on localhost, use localhost callback
        if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
          const localRedirect = `${currentOrigin}/auth/callback`;
          console.log('[SIGN-IN] Using local redirect URL:', localRedirect);
          return localRedirect;
        }
      }
      
      // Default to Railway URL for production
      const productionRedirect = getAuthRedirectUrl('/auth/callback');
      console.log('[SIGN-IN] Using production redirect URL:', productionRedirect);
      return productionRedirect;
    })();

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
  };

  return <SignInForm onGoogleSignIn={signInWithGoogle} />;
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
