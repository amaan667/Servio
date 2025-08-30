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
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAuthRedirectUrl('/auth/callback'),
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
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
