'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import SignInForm from './signin-form';

function SignInPageContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Check if Supabase is configured
      if (!supabase) {
        console.error('[AUTH] Supabase client not configured');
        console.error('[AUTH] Supabase client state:', { supabase: !!supabase });
        alert('Authentication service not available. Please check your environment configuration.');
        setLoading(false);
        return;
      }
      
      console.log('[AUTH] Supabase client is configured, proceeding with OAuth');
      
      // Use a consistent redirect URL that matches the Supabase configuration
      const redirectTo = 'https://servio-production.up.railway.app/auth/callback';
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
        console.error('[AUTH] Error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          stack: error.stack
        });
        alert(`Could not start Google sign-in: ${error.message || 'Please try again.'}`);
        setLoading(false);
        return;
      }
      
      console.log('[AUTH] Google OAuth redirect initiated successfully');
      // No else branch: in redirect flow, the browser navigates away.
    } catch (e: any) {
      console.error('[AUTH] Google sign-in threw:', e);
      alert('Sign-in failed to start. Please try again.');
      setLoading(false);
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
