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
  const [error, setError] = useState<string | null>(null);

  // Detect if we're on mobile
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  useEffect(() => {
    // Skip session check for now to test the sign-in form
    console.log('[AUTH DEBUG] Skipping session check, showing sign-in form directly');
    setIsCheckingSession(false);
    
    // Check for error parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      console.log('[AUTH DEBUG] Error parameter found:', errorParam);
      switch (errorParam) {
        case 'pkce_error':
          setError('Authentication failed due to security verification. Please try signing in again.');
          break;
        case 'refresh_token_error':
          setError('Your session has expired. Please sign in again.');
          break;
        default:
          setError('Authentication failed. Please try again.');
      }
    }
  }, []);

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
              await supabaseBrowser().auth.signOut();
      
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
      
      const { data, error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { 
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
          },
          // Enable PKCE for better security
          flowType: 'pkce',
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

  // Skip session check for testing
  if (false) {
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
        error={error}
        onClearError={() => setError(null)}
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
