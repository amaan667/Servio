'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');

    (async () => {
      try {
        if (error) {
          console.error('[AUTH] OAuth callback error:', error);
          router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
          return;
        }
        if (!code) {
          console.error('[AUTH] OAuth callback missing code');
          router.replace('/sign-in?error=missing_code');
          return;
        }

        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          console.error('[AUTH] exchangeCodeForSession failed:', exErr);
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        // Route based on whether venue exists
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/sign-in?error=no_user');
          return;
        }
        const { data: venues, error: vErr } = await supabase
          .from('venues').select('venue_id').eq('owner_id', user.id).limit(1);
        if (vErr) {
          console.warn('[AUTH] venue check error (non-fatal):', vErr.message);
        }
        router.replace(venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile');
      } catch (e: any) {
        console.error('[AUTH] Callback fatal:', e);
        router.replace('/sign-in?error=callback_failed');
      }
    })();
  }, [params, router]);

  return (
    <div className="min-h-[50vh] grid place-items-center">
      <p className="text-sm text-gray-600">Completing sign‑in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] grid place-items-center">
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
