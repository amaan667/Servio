'use client';

import { supabase } from '@/lib/sb-client';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const site = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://servio-production.up.railway.app');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${site}/auth/callback`,
        queryParams: { prompt: 'select_account' }
      }
    });
  };

  return (
    <button type="button" onClick={onGoogle} className="px-4 py-2 rounded bg-black text-white">
      Sign in with Google
    </button>
  );
}
