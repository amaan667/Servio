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
        console.error('[AUTH] OAuth error:', error);
        router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
        return;
      }
      if (!code) {
        console.error('[AUTH] No code in callback');
        router.replace('/sign-in?error=missing_code');
        return;
      }

      console.log('[AUTH] Starting PKCE exchange on client');
      
      // Do PKCE exchange on the client — has access to code_verifier
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[AUTH] exchange failed:', exchangeError);
        router.replace('/sign-in?error=exchange_failed');
        return;
      }

      console.log('[AUTH] PKCE exchange successful');

      // Route the user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[AUTH] No user after exchange');
        router.replace('/sign-in?error=no_user_after_exchange');
        return;
      }

      console.log('[AUTH] User authenticated:', user.id);

      const { data: venues, error: vErr } = await supabase
        .from('venues')
        .select('venue_id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (vErr) {
        console.error('[AUTH] Venues lookup failed:', vErr);
        router.replace('/sign-in?error=venues_lookup_failed');
        return;
      }

      if (!venues?.length) {
        console.log('[AUTH] New user, redirecting to complete profile');
        router.replace('/complete-profile');
      } else {
        console.log('[AUTH] Existing user, redirecting to dashboard');
        router.replace(`/dashboard/${venues[0].venue_id}`);
      }
    })();
  }, [params, router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-gray-600">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p>Completing sign-in…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] flex items-center justify-center text-gray-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
