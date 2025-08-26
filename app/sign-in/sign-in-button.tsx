'use client';

import { createClient } from '@/lib/supabase/client';

export default function SignInButton() {
  
  const onGoogle = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL || "";

    try {
      // Clear stale PKCE artifacts that can cause verifier mismatch
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.includes("pkce")) localStorage.removeItem(k);
      });
    } catch {}

    await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        flowType: 'pkce',
        redirectTo: `${origin}/auth/callback`,
      }
    });
  };

  return (
    <button type="button" onClick={onGoogle} className="px-4 py-2 rounded bg-black text-white">
      Sign in with Google
    </button>
  );
}
