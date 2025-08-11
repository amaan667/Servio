'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);

      // PKCE: ?code=...
      const code = url.searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return router.replace('/dashboard');
      }

      // Fallback: implicit hash tokens (#access_token=...)
      if (window.location.hash.includes('access_token=')) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) return router.replace('/dashboard');
        }
      }

      router.replace('/sign-in?error=no_code');
    };
    run();
  }, [router]);

  return null;
}
