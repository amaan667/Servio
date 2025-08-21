'use client';

import { supabase } from '@/lib/sb-client';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        queryParams: { prompt: 'select_account' }
      }
    });
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
