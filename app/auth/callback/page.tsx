'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const run = async () => {
      const href = window.location.href;
      const url = new URL(href);
      const code = url.searchParams.get('code');
      const hash = window.location.hash;

      console.log('[AUTH] callback href:', href);
      console.log('[AUTH] callback code:', code, 'hash:', hash);

      // PKCE path
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return router.replace('/dashboard');
        console.error('[AUTH] exchange error:', error?.message);
      }

      // Implicit fallback (some IdPs)
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.slice(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) return router.replace('/dashboard');
          console.error('[AUTH] setSession error:', error?.message);
        }
      }

      router.replace('/sign-in?error=no_code_or_tokens');
    };
    run();
  }, [router]);

  return null;
}
