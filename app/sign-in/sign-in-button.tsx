'use client';
import { supabase } from '@/lib/sb-client';
import { getAuthRedirectUrl } from '@/lib/auth';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const redirectUrl = getAuthRedirectUrl('/auth/callback');
    console.log('[AUTH] starting oauth with redirect:', redirectUrl);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl, // must be EXACT and allowed in Supabase dashboard
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
