'use client';

export const dynamic = 'force-dynamic';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Delay importing supabase until after mount to avoid build-time env evaluation
let supabaseBrowser: any = null;
let clearSupabaseAuth: any = null;
import { getAuthRedirectUrl } from '@/lib/auth';
import SignInForm from './signin-form';
import PkceDebugComponent from './pkce-debug';
import { AuthErrorBoundary } from '@/components/auth-error-boundary';

function SignInPageContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect if we're on mobile with improved detection
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 
      'iemobile', 'opera mini', 'mobile', 'tablet'
    ];
    return mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
           window.innerWidth <= 768;
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Lazy import
        const mod = await import('@/lib/supabase/browser');
        supabaseBrowser = mod.supabaseBrowser;
        clearSupabaseAuth = mod.clearSupabaseAuth;

        console.log('[AUTH DEBUG] Initializing sign-in page');
        console.log('[AUTH DEBUG] Platform:', isMobile() ? 'Mobile' : 'Desktop');
        console.log('[AUTH DEBUG] User Agent:', typeof window !== 'undefined' ? navigator.userAgent : 'SSR');
        
        // Clear any existing auth state more thoroughly
        await clearAuthState();
        
        // Check for error parameters in URL
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        
        if (errorParam) {
          console.log('[AUTH DEBUG] Error parameter found:', errorParam);
          handleAuthError(errorParam);
        }
        
        setIsCheckingSession(false);
      } catch (err) {
        console.error('[AUTH DEBUG] Error initializing auth:', err);
        setError('Failed to initialize authentication. Please refresh the page.');
        setIsCheckingSession(false);
      }
    };

    initializeAuth();
  }, []);

  const clearAuthState = async () => {
    try {
      console.log('[AUTH DEBUG] Clearing existing auth state...');
      await clearSupabaseAuth();
      console.log('[AUTH DEBUG] Auth state cleared successfully');
    } catch (err) {
      console.error('[AUTH DEBUG] Error clearing auth state:', err);
    }
  };

  const handleAuthError = (errorType: string) => {
    switch (errorType) {
      case 'pkce_error':
        setError('Authentication failed due to security verification. Please try signing in again.');
        break;
      case 'refresh_token_error':
        setError('Your session has expired. Please sign in again.');
        break;
      case 'network_error':
        setError('Network connection issue. Please check your internet connection and try again.');
        break;
      case 'timeout_error':
        setError('Authentication timed out. Please try signing in again.');
        break;
      default:
        setError('Authentication failed. Please try again.');
    }
  };

  const signInWithGoogle = async () => {
    if (isSigningIn) {
      console.log('[AUTH DEBUG] Sign-in already in progress, ignoring click');
      return;
    }
    
    try {
      setIsSigningIn(true);
      setError(null); // Clear any previous errors

      console.log('[AUTH DEBUG] ===== STARTING GOOGLE OAUTH =====');
      console.log('[AUTH DEBUG] Platform:', isMobile() ? 'Mobile' : 'Desktop');
      
      // Clear auth state before starting
      await clearAuthState();
      
      // Use stable redirect URL helper
      const redirectTo = getAuthRedirectUrl('/auth/callback');
      console.log('[AUTH DEBUG] Redirect URL:', redirectTo);
      console.log('[AUTH DEBUG] Current origin:', typeof window !== 'undefined' ? window.location.origin : 'SSR');
      
      // Add timeout for OAuth initiation
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('OAuth initiation timeout'));
        }, 10000); // 10 second timeout
      });

      const oauthPromise = supabaseBrowser().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { 
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
          },
          flowType: 'pkce',
        },
      });

      const { data, error } = await Promise.race([oauthPromise, timeoutPromise]) as any;
      
      console.log('[AUTH DEBUG] OAuth signInWithOAuth result:', {
        hasData: !!data,
        hasUrl: !!data?.url,
        error: error?.message,
        errorCode: error?.status
      });
      
      if (error) {
        console.error('[AUTH DEBUG] OAuth sign in error:', error);
        throw error;
      }
      
      console.log('[AUTH DEBUG] OAuth sign in initiated successfully:', data);
      
      if (data?.url) {
        console.log('[AUTH DEBUG] OAuth URL received, redirecting...');
        console.log('[AUTH DEBUG] OAuth URL:', data.url);
        
        // Add a small delay to ensure state is properly set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Use window.location.href for reliable redirect
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL received');
      }
    } catch (err: any) {
      console.error('[AUTH DEBUG] Unexpected error during OAuth sign in:', err);
      
      // Handle specific error types
      if (err.message?.includes('timeout')) {
        setError('Authentication timed out. Please try again.');
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(`Authentication failed: ${err.message || 'Unknown error'}`);
      }
      
      setIsSigningIn(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthErrorBoundary>
      <SignInForm 
        onGoogleSignIn={signInWithGoogle} 
        isLoading={isSigningIn}
        error={error}
        onClearError={() => setError(null)}
      />
    </AuthErrorBoundary>
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
