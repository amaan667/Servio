'use client';

import { supabase } from '@/lib/sb-client';

export default function SignInButton() {
  
  const onGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        flowType: "pkce",
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
        queryParams: { prompt: 'select_account' }
      }
    });
  };

  return (
    <button 
      type="button"
      onClick={onGoogle} 
      className="px-4 py-2 rounded bg-black text-white"
    >
      Sign in with Google
    </button>
  );
}
