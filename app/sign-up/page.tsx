'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Use the current origin for redirect, fallback to production
      const redirectTo = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : 'https://servio-production.up.railway.app/auth/callback';
        
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

  return <SignUpForm onGoogleSignIn={signInWithGoogle} loading={loading} />;
}
