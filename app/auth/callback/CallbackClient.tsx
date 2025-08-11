'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CallbackClient() {
  const [msg, setMsg] = useState('Booting…');
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');

        if (!code) {
          setMsg('No code → /sign-in');
          router.replace('/sign-in?error=no_code');
          return;
        }

        setMsg('Exchanging code…');
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg('Exchange failed: ' + error.message);
          router.replace('/sign-in?error=exchange');
          return;
        }

        setMsg('Exchange OK → /dashboard');
        // small delay gives middleware time to sync cookies for SSR
        setTimeout(() => router.replace('/dashboard'), 50);
      } catch (e: any) {
        setMsg('Callback crashed: ' + (e?.message || String(e)));
        router.replace('/sign-in?error=callback_crash');
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

