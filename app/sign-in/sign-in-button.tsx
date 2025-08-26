'use client';

import { createClient } from '@/lib/supabase/client';

export default function SignInButton() {
  
  const onGoogle = async () => {
    // Clean any stale PKCE artifacts that can break the next run
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
      });
    } catch {}
    
    const site = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://servio-production.up.railway.app');
    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${site}/auth/callback`,
        flowType: 'pkce',
      }
    });
  };

  return (
    <button type="button" onClick={onGoogle} className="px-4 py-2 rounded bg-black text-white">
      Sign in with Google
    </button>
  );
}
