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
      if (error) {
        router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
        return;
      }
      if (!code) {
        router.replace('/sign-in?error=missing_code');
        return;
      }
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) {
        console.error('[AUTH] exchange failed:', exErr);
        router.replace('/sign-in?error=exchange_failed');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/sign-in?error=no_user');
        return;
      }
      const { data: venues } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .limit(1);
      router.replace(venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile');
    })();
  }, [params, router]);

  return <div className="min-h-[50vh] flex items-center justify-center">Completing sign-in…</div>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center">Loading...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
