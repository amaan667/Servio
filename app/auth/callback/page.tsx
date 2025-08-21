'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

function now() {
  return new Date().toISOString();
}

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('Starting...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');

    console.log('[AUTH DEBUG] callback:start', { t: now(), hasCode: !!code, hasError: !!error });

    (async () => {
      try {
        if (error) {
          console.log('[AUTH DEBUG] callback:oauth_error', { t: now(), error });
          setStatus('OAuth error received');
          router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
          return;
        }
        
        if (!code) {
          console.log('[AUTH DEBUG] callback:missing_code', { t: now() });
          setStatus('No code received');
          router.replace('/sign-in?error=missing_code');
          return;
        }

        setStatus('Checking existing session...');
        console.log('[AUTH DEBUG] callback:getSession:begin', { t: now() });
        const { data: init, error: initErr } = await supabase.auth.getSession();
        console.log('[AUTH DEBUG] callback:getSession:done', { t: now(), hasSession: !!init?.session, userId: init?.session?.user?.id, err: initErr?.message });

        if (!init?.session?.user) {
          setStatus('Exchanging code for session...');
          console.log('[AUTH DEBUG] callback:exchange:begin', { t: now() });
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          console.log('[AUTH DEBUG] callback:exchange:done', { t: now(), ok: !exErr, err: exErr?.message });
          if (exErr) {
            setStatus('Exchange failed');
            setError(exErr.message);
            router.replace('/sign-in?error=exchange_failed');
            return;
          }
        } else {
          console.log('[AUTH DEBUG] callback:exchange:skipped_existing_session', { t: now(), userId: init.session.user.id });
        }

        setStatus('Getting user data...');
        console.log('[AUTH DEBUG] callback:getUser:begin', { t: now() });
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        console.log('[AUTH DEBUG] callback:getUser:done', { t: now(), hasUser: !!user, userId: user?.id, err: userErr?.message });
        if (!user) {
          setStatus('No user found');
          router.replace('/sign-in?error=no_user');
          return;
        }

        setStatus('Checking venues...');
        console.log('[AUTH DEBUG] callback:venues:begin', { t: now(), userId: user.id });
        try {
          const venuePromise = supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', user.id)
            .limit(1);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Venue query timeout')), 5000));
          const result: any = await Promise.race([venuePromise, timeoutPromise]);
          const venues = result?.data as any[] | undefined;
          const venueErr = result?.error as any | undefined;
          console.log('[AUTH DEBUG] callback:venues:done', { t: now(), count: venues?.length ?? 0, err: venueErr?.message });

          setStatus('Redirecting...');
          const redirectPath = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
          console.log('[AUTH DEBUG] callback:redirect', { t: now(), redirectPath });
          router.replace(redirectPath);
        } catch (venueTimeout) {
          console.log('[AUTH DEBUG] callback:venues:timeout', { t: now(), message: (venueTimeout as Error).message });
          setStatus('Venue lookup timed out, going to profile setup');
          router.replace('/complete-profile');
        }
      } catch (err: any) {
        console.log('[AUTH DEBUG] callback:unexpected', { t: now(), message: err?.message });
        setStatus('Unexpected error');
        setError(err.message);
        router.replace('/sign-in?error=unexpected_error');
      }
    })();

    const timeout = setTimeout(() => {
      console.log('[AUTH DEBUG] callback:overall_timeout', { t: now() });
      setStatus('Timeout reached');
      setError('Callback timed out - please try signing in again');
      router.replace('/sign-in?error=timeout');
    }, 15000);

    return () => clearTimeout(timeout);
  }, [params, router]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      <p className="text-gray-600">{status}</p>
      {error && (
        <div className="text-red-600 text-sm max-w-md text-center">
          Error: {error}
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center">Loading...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
