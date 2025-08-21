'use client';

import { supabase } from '@/lib/sb-client';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const signInWithGoogle = async () => {
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
    // Force production callback target
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) console.error('[AUTH] Sign-in error:', error);
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
