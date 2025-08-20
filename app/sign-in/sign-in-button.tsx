'use client';
import { supabase } from '@/lib/sb-client';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;
    console.log('[AUTH] starting oauth');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${APP_URL}/auth/callback`, // must be EXACT and allowed in Supabase dashboard
        queryParams: { access_type: 'offline', prompt: 'consent' }, // ensures refresh token
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
