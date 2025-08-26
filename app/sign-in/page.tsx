'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/sb-client';
import SignInForm from './signin-form';

function SignInPageContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Use the current origin for redirect, fallback to production
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/dashboard`
        : 'https://servio-production.up.railway.app/dashboard';
        
      console.log('[AUTH] Starting Google OAuth redirect to:', redirectTo);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          // Force Google account chooser and avoid cached flows that can hang.
          queryParams: { prompt: 'select_account' },
        },
      });
      
      if (error) {
        console.error('[AUTH] Google redirect start failed:', error);
        throw new Error(error.message || 'Could not start Google sign-in');
      }
      
      console.log('[AUTH] Google OAuth redirect initiated successfully');
      // The browser will navigate away in the OAuth flow
    } catch (e: any) {
      console.error('[AUTH] Google sign-in threw:', e);
      setLoading(false);
      throw e; // Re-throw to let the form handle the error
    }
  };

  return <SignInForm onGoogleSignIn={signInWithGoogle} loading={loading} />;
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
