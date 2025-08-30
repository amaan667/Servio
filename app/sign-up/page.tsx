'use client';

import { supabase } from '@/lib/sb-client';
import { getAuthRedirectUrl } from '@/lib/auth';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
  redirectTo: getAuthRedirectUrl('/auth/callback'),
        queryParams: { access_type: 'offline', prompt: 'consent' }, // get refresh token
      },
    });
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
