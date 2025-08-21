'use client';

import { supabase } from '@/lib/sb-client';
import SignUpForm from './signup-form';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!; // e.g. https://servio-production.up.railway.app

export default function SignUpPage() {
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${APP_URL}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' }, // get refresh token
      },
    });
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
