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

      // PKCE path
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return router.replace('/dashboard');
        console.error('exchange error:', error?.message);
      }

      // Implicit fallback
      if (window.location.hash.includes('access_token=')) {
        const p = new URLSearchParams(window.location.hash.slice(1));
        const access_token = p.get('access_token');
        const refresh_token = p.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) return router.replace('/dashboard');
          console.error('setSession error:', error?.message);
        }
      }

      router.replace('/sign-in?error=no_code_or_tokens');
    };
    run();
  }, [router]);

  return null;
}
