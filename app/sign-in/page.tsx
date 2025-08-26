'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import SignInForm from './signin-form';

function SignInPageContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try { localStorage.removeItem('sb-pkce-code-verifier'); } catch {}
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('[AUTH DEBUG] Starting Google OAuth flow');
      setLoading(true);
      
      // Use the current domain for OAuth redirects to ensure PKCE works correctly
      const site = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
      const redirectTo = `${site}/auth/callback`;
      console.log('[AUTH DEBUG] OAuth redirect URL:', redirectTo);
      
      // Add timeout to the OAuth initiation
      const oauthPromise = supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          flowType: 'pkce',
          queryParams: { 
            prompt: 'select_account'
          },
        },
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OAuth initiation timeout')), 10000); // 10 second timeout
      });
      
      const { error } = await Promise.race([oauthPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('[AUTH DEBUG] Google OAuth error:', error);
        console.error('[AUTH DEBUG] Error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        
        // Provide more specific error messages
        let userMessage = 'Could not start Google sign-in. Please try again.';
        if (error.message?.includes('timeout')) {
          userMessage = 'Sign-in request timed out. Please check your connection and try again.';
        } else if (error.message?.includes('network')) {
          userMessage = 'Network error. Please check your connection and try again.';
        }
        
        alert(userMessage);
        setLoading(false);
        return;
      }
      
      console.log('[AUTH DEBUG] Google OAuth initiated successfully - browser should redirect');
      // No else branch: in redirect flow, the browser navigates away.
    } catch (e: any) {
      console.error('[AUTH DEBUG] Google OAuth exception:', e);
      console.error('[AUTH DEBUG] Exception details:', {
        message: e?.message,
        name: e?.name,
        stack: e?.stack
      });
      
      let userMessage = 'Sign-in failed to start. Please try again.';
      if (e?.message?.includes('timeout')) {
        userMessage = 'Sign-in request timed out. Please check your connection and try again.';
      } else if (e?.message?.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      }
      
      alert(userMessage);
      setLoading(false);
    }
  };

  console.log('[AUTH DEBUG] SignInPageContent rendered, loading state:', loading);

  return <SignInForm onGoogleSignIn={signInWithGoogle} loading={loading} />;
}

export default function SignInPage() {
  console.log('[AUTH DEBUG] SignInPage component mounted');
  
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
