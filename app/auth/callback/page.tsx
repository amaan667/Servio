'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');

    (async () => {
      try {
        if (error) {
          console.error('[AUTH DEBUG] OAuth callback error:', error);
          router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
          return;
        }
        if (!code) {
          console.error('[AUTH DEBUG] OAuth callback missing code');
          router.replace('/sign-in?error=missing_code');
          return;
        }

        const supabase = createClient();
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          console.error('[AUTH DEBUG] exchangeCodeForSession failed:', exErr);
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        // Route to dashboard after successful auth
        console.log('[AUTH DEBUG] OAuth callback successful, redirecting to dashboard');
        router.replace('/dashboard');
      } catch (e: any) {
        console.error('[AUTH DEBUG] Callback fatal:', e);
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
