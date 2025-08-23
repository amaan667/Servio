'use client';

import { supabase } from '@/lib/supabaseClient';

export default function SignInButton() {
  
  const onGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://servio-production.up.railway.app',
        queryParams: { prompt: 'select_account' }
      }
    });
  };

  return (
    <button onClick={onGoogle} className="px-4 py-2 rounded bg-black text-white">
      Sign in with Google
    </button>
  );
}
