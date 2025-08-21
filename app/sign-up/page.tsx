'use client';

import { supabase } from '@/lib/sb-client';
import { getAuthRedirectUrl } from '@/lib/auth';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const signInWithGoogle = async () => {
    // Always use production URL for OAuth to prevent localhost issues
    const redirectUrl = 'https://servio-production.up.railway.app/auth/callback';
    console.log('[AUTH] OAuth redirect URL:', redirectUrl);
    
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: { access_type: 'offline', prompt: 'consent' }, // get refresh token
      },
    });
  };

  return <SignUpForm onGoogleSignIn={signInWithGoogle} />;
}
