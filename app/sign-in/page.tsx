'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import SignInForm from './signin-form';

function SignInPageContent() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Clean any stale PKCE artifacts that can break the next run
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
      });
    } catch {}
  }, []);

  const signInWithGoogle = async () => {
    try {
      console.log('[AUTH DEBUG] Starting Google OAuth flow');
      setLoading(true);
      
      const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "";
      
      try {
        // Clear stale PKCE artifacts that can cause verifier mismatch
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
        });
      } catch {}

      await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          flowType: "pkce",
          redirectTo: `${origin}/auth/callback`,
        },
      });
      
      console.log('[AUTH DEBUG] Google OAuth initiated successfully - browser should redirect');
    } catch (e: any) {
      console.error('[AUTH DEBUG] Google OAuth exception:', e);
      alert('Sign-in failed to start. Please try again.');
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
