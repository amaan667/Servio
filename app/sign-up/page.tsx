'use client';

import { createBrowserClient } from '@supabase/ssr';
import SignUpForm from './signup-form';

export default function SignUpPage() {
  const signInWithGoogle = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          storageKey: 'supabase.auth.token',
        },
      }
    );
    
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
