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
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (!code) { 
        setMsg('No code → /sign-in'); 
        router.replace('/sign-in?error=no_code'); 
        return; 
      }

      setMsg('Exchanging code…');
      // add a timeout so we see hangs
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
      try {
        await Promise.race([
          supabase.auth.exchangeCodeForSession(code),
          timeout,
        ]);
        setMsg('Exchange OK → /dashboard');
        setTimeout(() => router.replace('/dashboard'), 50);
      } catch (e: any) {
        setMsg(`Exchange failed: ${e?.message || e}`);
        router.replace('/sign-in?error=exchange_failed');
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

