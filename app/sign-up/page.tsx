'use client';

import { useState } from 'react';
import { supabase } from '@/lib/sb-client';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Check if Supabase is configured
      if (!supabase) {
        console.error('[AUTH] Supabase client not configured');
        alert('Authentication service not available. Please try again later.');
        setLoading(false);
        return;
      }
      
      // Use a consistent redirect URL that matches the Supabase configuration
      const redirectTo = 'https://servio-production.up.railway.app/auth/callback';
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
