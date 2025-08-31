'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { getAuthRedirectUrl } from '@/lib/auth';
import SignInForm from './signin-form';
import PkceDebugComponent from './pkce-debug';

function SignInPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        console.log('[AUTH DEBUG] Checking existing session...');
        
        // Check if user is already signed in
        const { data: { session }, error } = await supabaseBrowser.auth.getSession();
        
        if (error) {
          console.error('[AUTH DEBUG] Session check error:', error);
          setIsCheckingSession(false);
          return;
        }
        
        if (session) {
          console.log('[AUTH DEBUG] User already signed in, redirecting to dashboard');
          router.replace('/dashboard');
          return;
        }
        
        console.log('[AUTH DEBUG] No existing session, showing sign-in form');
        setIsCheckingSession(false);
      } catch (err) {
        console.error('[AUTH DEBUG] Error checking session:', err);
        setIsCheckingSession(false);
      }
    };
    run();
  }, [router, sp]);

  const signInWithGoogle = async () => {
    if (isSigningIn) {
      console.log('[AUTH DEBUG] Sign-in already in progress, ignoring click');
      return;
    }
    
    try {
      setIsSigningIn(true);
      console.log('[AUTH DEBUG] Starting Google OAuth sign in');
      
      // Clear any existing auth state that might interfere
      await supabaseBrowser.auth.signOut();
      
      // Use stable redirect URL helper
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      console.log('[AUTH DEBUG] Redirect URL:', redirectTo);
      
      const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { 
            access_type: 'offline',
            prompt: 'consent' // Changed from 'select_account' to 'consent' for refresh tokens
          },
        },
      });
      
      if (error) {
        console.error('[AUTH DEBUG] OAuth sign in error:', error);
        alert(`Sign in failed: ${error.message}`);
        setIsSigningIn(false);
        return;
      }
      
      console.log('[AUTH DEBUG] OAuth sign in initiated successfully:', data);
      
      // The redirect should happen automatically, but if it doesn't, we'll handle it
      if (data.url) {
        console.log('[AUTH DEBUG] Redirecting to OAuth URL');
        window.location.href = data.url;
      } else {
        console.error('[AUTH DEBUG] No OAuth URL received');
        alert('Failed to start OAuth flow - no redirect URL received');
        setIsSigningIn(false);
      }
    } catch (err: any) {
      console.error('[AUTH DEBUG] Unexpected error during OAuth sign in:', err);
      alert(`Unexpected error: ${err.message}`);
      setIsSigningIn(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SignInForm onSignIn={signInWithGoogle} isLoading={isSigningIn} />
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
