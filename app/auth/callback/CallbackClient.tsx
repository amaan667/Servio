'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function CallbackClient() {
  const [msg, setMsg] = useState('Booting…');
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const run = async () => {
      try {
        // If we already have a session (your console showed SIGNED_IN), just go
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          setMsg('Session present → /dashboard');
          router.replace('/dashboard');
          return;
        }

        const href = window.location.href;
        const url = new URL(href);
        const code = url.searchParams.get('code');
        const hash = window.location.hash;

        if (code) {
          setMsg('Exchanging code…');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) return router.replace('/dashboard');
          setMsg('Exchange failed: ' + error.message);
          setTimeout(() => router.replace('/sign-in?error=exchange'), 1000);
          return;
        }

        if (hash?.includes('access_token=')) {
          setMsg('Setting hash session…');
          const p = new URLSearchParams(hash.slice(1));
          const access_token = p.get('access_token');
          const refresh_token = p.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error) return router.replace('/dashboard');
            setMsg('setSession failed: ' + error.message);
            setTimeout(() => router.replace('/sign-in?error=setSession'), 1000);
            return;
          }
        }

        setMsg('No code/tokens → /sign-in');
        router.replace('/sign-in?error=no_code');
      } catch (e: any) {
        setMsg('Callback crash: ' + (e?.message || String(e)));
        setTimeout(() => router.replace('/sign-in?error=callback_crash'), 1000);
      }
    };
    run();
  }, [router, supabase]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Finishing sign in…</h1>
      <p>{msg}</p>
    </div>
  );
}
