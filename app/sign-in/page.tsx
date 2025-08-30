'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/sb-client';
import { getAuthRedirectUrl } from '@/lib/auth';
import SignInForm from './signin-form';
import PkceDebugComponent from './pkce-debug';

function SignInPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const run = async () => {
      // Check if user is already signed in
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) return; // show form

      // If already signed in, redirect to dashboard
      console.log('[SIGN-IN] User already signed in, redirecting to dashboard');
      router.replace('/dashboard');
    };
    run();
  }, [router, sp]);

  const signInWithGoogle = async () => {
    try {
      console.log('[AUTH DEBUG] Starting Google OAuth sign in');
      
      // Use stable production redirect URL helper
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { 
            access_type: 'offline',
            prompt: 'select_account'
          },
        },
      });
      
      if (error) {
        console.error('[AUTH DEBUG] OAuth sign in error:', error);
        alert(`Sign in failed: ${error.message}`);
        return;
      }
      console.log('[AUTH DEBUG] OAuth sign in initiated successfully:', data);
    } catch (err: any) {
      console.error('[AUTH DEBUG] Unexpected error during OAuth sign in:', err);
      alert(`Unexpected error: ${err.message}`);
    }
  };

  return (
    <>
      <SignInForm />
      <div className="fixed bottom-4 right-4 z-50">
        <PkceDebugComponent />
      </div>
    </>
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
