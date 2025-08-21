'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import SignInForm from './signin-form';

function SignInPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  // Remove automatic redirect to prevent loops
  // Let users stay on sign-in page even if they have a session

  const signInWithGoogle = async () => {
    const supabase = supabaseBrowser();
    const base = process.env.NEXT_PUBLIC_APP_URL!;
    // Force production callback target
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${base}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) console.error('[AUTH] Sign-in error:', error);
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
