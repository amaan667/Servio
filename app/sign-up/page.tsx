'use client';

import { supabaseBrowser } from '@/lib/supabase-browser';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const signInWithGoogle = async () => {
    const supabase = supabaseBrowser();
    const base = process.env.NEXT_PUBLIC_APP_URL!;
    // Force production callback target
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${base}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) console.error('[AUTH] Sign-in error:', error);
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
