'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { getAuthRedirectUrl } from '@/lib/auth';
import { useAuth } from '@/app/auth/AuthProvider';
import SignInForm from './signin-form';

function SignInPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { session, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect if we're on mobile
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  useEffect(() => {
    // Check if user is already authenticated
    if (!loading && session?.user) {
      router.replace('/dashboard');
      return;
    }
    
    // Check for error parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
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
  }, [session, loading, router]);

  const signInWithGoogle = async () => {
    if (isSigningIn) {
      return;
    }
    
    try {
      setIsSigningIn(true);

      // Use stable redirect URL helper
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      
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
      
      if (error) {
        console.error('OAuth sign in error:', error);
        alert(`Sign in failed: ${error.message}`);
        setIsSigningIn(false);
        return;
      }
      
      // The redirect should happen automatically, but if it doesn't, we'll handle it
      if (data.url) {
        // On desktop, use window.location.href for full page redirect
        if (!isMobile()) {
          window.location.href = data.url;
        } else {
          // On mobile, try to use the OAuth URL directly
          window.location.href = data.url;
        }
      }
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Sign in failed. Please try again.');
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (session?.user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md mx-auto">
        <SignInForm 
          onGoogleSignIn={signInWithGoogle}
          isLoading={isSigningIn}
          error={error}
          onClearError={() => setError(null)}
        />
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    }>
      <SignInPageContent />
    </Suspense>
  );
}
