// app/auth/callback/page.tsx
'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function AuthCallback() {
  const [msg, setMsg] = useState('Booting…');
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const run = async () => {
      try {
        const href = window.location.href;
        const url = new URL(href);
        const code = url.searchParams.get('code');
        const hash = window.location.hash;

        console.log('[AUTH] callback href:', href);
        console.log('[AUTH] code present?', !!code, 'hash length:', hash?.length || 0);
        setMsg(`Parsed URL. code=${!!code} hash=${hash ? 'yes' : 'no'}`);

        // PKCE path
        if (code) {
          setMsg('Exchanging code for session…');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[AUTH] exchange error:', error.message);
            setMsg('Exchange failed: ' + error.message);
            // Give the middleware a chance to sync if partial cookies exist
            setTimeout(() => router.replace('/sign-in?error=exchange'), 1200);
            return;
          }
          setMsg('Exchange OK → /dashboard');
          router.replace('/dashboard');
          return;
        }

        // Implicit fallback
        if (hash?.includes('access_token=')) {
          setMsg('Found hash tokens, setting session…');
          const p = new URLSearchParams(hash.slice(1));
          const access_token = p.get('access_token');
          const refresh_token = p.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              console.error('[AUTH] setSession error:', error.message);
              setMsg('setSession failed: ' + error.message);
              setTimeout(() => router.replace('/sign-in?error=setSession'), 1200);
              return;
            }
            setMsg('Session set → /dashboard');
            router.replace('/dashboard');
            return;
          }
        }

        setMsg('No code or tokens in URL → /sign-in');
        router.replace('/sign-in?error=no_code');
      } catch (e: any) {
        console.error('[AUTH] callback crash:', e);
        setMsg('Callback crashed: ' + (e?.message || String(e)));
        setTimeout(() => router.replace('/sign-in?error=callback_crash'), 1200);
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
