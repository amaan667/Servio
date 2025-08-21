'use client';

import { supabase } from '@/lib/sb-client';
import SignUpForm from './signup-form';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!; // e.g. https://servio-production.up.railway.app

export default function SignUpPage() {
  async function signInWithGoogle() {
    // Must be client-side; this sets the PKCE verifier + state on the same origin
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${APP_URL}/auth/callback`, // MUST match Supabase redirect URL
        queryParams: { access_type: 'offline', prompt: 'consent' }, // get refresh token
      },
    });
  }

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
