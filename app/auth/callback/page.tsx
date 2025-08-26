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

        console.log('[AUTH DEBUG] Auth callback processing code exchange');
        const supabase = createClient();
        
        // Try the new exchangeCodeForSession method first
        try {
          const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            console.error('[AUTH DEBUG] exchangeCodeForSession failed:', exErr);
            throw exErr;
          }
          
          if (data.session) {
            console.log('[AUTH DEBUG] OAuth callback successful, redirecting to dashboard');
            router.replace('/dashboard');
            return;
          } else {
            throw new Error('No session returned from code exchange');
          }
        } catch (exErr: any) {
          console.error('[AUTH DEBUG] exchangeCodeForSession failed, trying fallback:', exErr);
          
          // Fallback: try the old method with queryParams
          const url = new URL(window.location.href);
          const { data, error: fallbackErr } = await supabase.auth.exchangeCodeForSession({
            queryParams: url.searchParams,
          });
          
          if (fallbackErr) {
            console.error('[AUTH DEBUG] Fallback exchangeCodeForSession also failed:', fallbackErr);
            router.replace('/sign-in?error=exchange_failed');
            return;
          }
          
          if (data.session) {
            console.log('[AUTH DEBUG] Fallback OAuth callback successful, redirecting to dashboard');
            router.replace('/dashboard');
            return;
          } else {
            router.replace('/sign-in?error=no_session');
            return;
          }
        }
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
