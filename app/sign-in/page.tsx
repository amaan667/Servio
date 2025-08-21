'use client';

import { supabase } from '@/lib/sb-client';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!; // e.g. https://servio-production.up.railway.app

export default function SignInPage() {
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${APP_URL}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' }, // get refresh token
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <button
        className="px-4 py-2 rounded bg-black text-white"
        onClick={signInWithGoogle}
      >
        Continue with Google
      </button>
    </div>
  );
}
