'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { getAuthRedirectUrl } from '@/lib/auth';
import SignInForm from './signin-form';

// Function to send debug logs to server
async function sendDebugLog(action: string, data: any, error?: any) {
  try {
    await fetch('/api/auth/debug-oauth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        data,
        error,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    console.error('[AUTH DEBUG] Failed to send debug log:', err);
  }
}

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
      await sendDebugLog('USER_ALREADY_SIGNED_IN', { 
        userId: session.user.id,
        userEmail: session.user.email 
      });
      router.replace('/dashboard');
    };
    run();
  }, [router, sp]);

  const signInWithGoogle = async () => {
    try {
      console.log('[AUTH DEBUG] Starting Google OAuth sign in');
      await sendDebugLog('OAUTH_SIGN_IN_START', { 
        provider: 'google',
        timestamp: new Date().toISOString()
      });
      
      // Use stable production redirect URL helper
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
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
        await sendDebugLog('OAUTH_SIGN_IN_ERROR', { 
          error: error.message,
          errorCode: error.status 
        });
        alert(`Sign in failed: ${error.message}`);
        return;
      }
      
      console.log('[AUTH DEBUG] OAuth sign in initiated successfully:', data);
      await sendDebugLog('OAUTH_SIGN_IN_SUCCESS', { 
        hasData: !!data,
        url: data?.url,
        provider: data?.provider
      });
      
    } catch (err: any) {
      console.error('[AUTH DEBUG] Unexpected error during OAuth sign in:', err);
      await sendDebugLog('OAUTH_SIGN_IN_UNEXPECTED_ERROR', { 
        error: err.message,
        stack: err.stack 
      });
      alert(`Unexpected error: ${err.message}`);
    }
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
