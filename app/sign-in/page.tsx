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

  // Detect if we're on mobile
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  useEffect(() => {
    const run = async () => {
      try {
        console.log('[AUTH DEBUG] ===== SIGN-IN PAGE LOADED =====');
        console.log('[AUTH DEBUG] Platform:', isMobile() ? 'Mobile' : 'Desktop');
        console.log('[AUTH DEBUG] User Agent:', typeof window !== 'undefined' ? navigator.userAgent : 'SSR');
        console.log('[AUTH DEBUG] Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
        console.log('[AUTH DEBUG] Checking existing session...');
        
        // Check if user is already signed in
        const { data: { session }, error } = await supabaseBrowser.auth.getSession();
        
        console.log('[AUTH DEBUG] Session check result:', {
          hasSession: !!session,
          error: error?.message,
          sessionExpiry: session?.expires_at,
          userId: session?.user?.id
        });
        
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

      console.log('[AUTH DEBUG] ===== STARTING GOOGLE OAUTH =====');
      console.log('[AUTH DEBUG] Starting Google OAuth sign in');
      console.log('[AUTH DEBUG] Platform:', isMobile() ? 'Mobile' : 'Desktop');
      
      // Clear any existing auth state that might interfere
      console.log('[AUTH DEBUG] Clearing existing auth state...');
      await supabaseBrowser.auth.signOut();
      
      // Clear any remaining auth-related storage to prevent state conflicts
      try {
        const authKeys = Object.keys(localStorage).filter(k => 
          k.includes('auth') || k.includes('supabase') || k.includes('sb-')
        );
        console.log('[AUTH DEBUG] Clearing localStorage keys:', authKeys);
        authKeys.forEach(key => localStorage.removeItem(key));
        
        const sessionAuthKeys = Object.keys(sessionStorage).filter(k => 
          k.includes('auth') || k.includes('supabase') || k.includes('sb-')
        );
        console.log('[AUTH DEBUG] Clearing sessionStorage keys:', sessionAuthKeys);
        sessionAuthKeys.forEach(key => sessionStorage.removeItem(key));
      } catch (err) {
        console.error('[AUTH DEBUG] Error clearing storage:', err);
      }
      
      // Use stable redirect URL helper
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      console.log('[AUTH DEBUG] Redirect URL:', redirectTo);
      console.log('[AUTH DEBUG] Current origin:', typeof window !== 'undefined' ? window.location.origin : 'SSR');
      
      const { data, error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { 
            access_type: 'offline',
            prompt: 'consent', // Changed from 'select_account' to 'consent' for refresh tokens
            // Add additional parameters to ensure proper state handling
            include_granted_scopes: 'true',
            response_type: 'code'
          },
        },
      });
      
      console.log('[AUTH DEBUG] OAuth signInWithOAuth result:', {
        hasData: !!data,
        hasUrl: !!data?.url,
        error: error?.message,
        errorCode: error?.status
      });
      
      if (error) {
        console.error('[AUTH DEBUG] OAuth sign in error:', error);
        console.error('[AUTH DEBUG] Error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        alert(`Sign in failed: ${error.message}`);
        setIsSigningIn(false);
        return;
      }
      
      console.log('[AUTH DEBUG] OAuth sign in initiated successfully:', data);
      
      // The redirect should happen automatically, but if it doesn't, we'll handle it
      if (data.url) {
        console.log('[AUTH DEBUG] OAuth URL received, redirecting...');
        console.log('[AUTH DEBUG] OAuth URL:', data.url);
        
        // On desktop, use window.location.href for full page redirect
        // On mobile, this might work better with the OAuth flow
        if (isMobile()) {
          console.log('[AUTH DEBUG] Mobile platform detected, using window.location.href');
        } else {
          console.log('[AUTH DEBUG] Desktop platform detected, using window.location.href');
        }
        
        console.log('[AUTH DEBUG] About to redirect to OAuth URL...');
        window.location.href = data.url;
      } else {
        console.error('[AUTH DEBUG] No OAuth URL received');
        console.error('[AUTH DEBUG] Data received:', data);
        alert('Failed to start OAuth flow - no redirect URL received');
        setIsSigningIn(false);
      }
    } catch (err: any) {
      console.error('[AUTH DEBUG] Unexpected error during OAuth sign in:', err);
      console.error('[AUTH DEBUG] Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
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
      <SignInForm 
        onGoogleSignIn={signInWithGoogle} 
        isLoading={isSigningIn} 
      />
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
