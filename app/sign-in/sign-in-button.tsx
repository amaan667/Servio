'use client';

import { supabaseBrowser } from '@/lib/supabase-browser';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const supabase = supabaseBrowser();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
    console.log('[AUTH] starting oauth with redirect:', redirectTo);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo, // must be EXACT and allowed in Supabase dashboard
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return alert(error.message);
    if (data?.url) window.location.href = data.url; // force navigation
  };

  return (
    <button onClick={onGoogle} className="px-4 py-2 rounded bg-black text-white">
      Sign in with Google
    </button>
  );
}
