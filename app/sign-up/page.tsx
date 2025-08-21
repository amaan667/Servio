'use client';

import { useState } from 'react';
import { supabase } from '@/lib/sb-client';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;
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
        alert('Could not start Google sign-in. Please try again.');
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

  return <SignUpForm onGoogleSignIn={signInWithGoogle} loading={loading} />;
}
