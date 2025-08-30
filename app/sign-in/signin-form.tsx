'use client';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginButton() {
  const signIn = async () => {
    await supabaseBrowser.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  };
  return <button onClick={signIn}>Sign in with Google</button>;
}
