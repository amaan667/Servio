'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('Starting...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');

    console.log('[AUTH CALLBACK] Starting callback process', { hasCode: !!code, hasError: !!error });

    (async () => {
      try {
        if (error) {
          console.log('[AUTH CALLBACK] OAuth error received:', error);
          setStatus('OAuth error received');
          router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
          return;
        }
        
        if (!code) {
          console.log('[AUTH CALLBACK] No code received');
          setStatus('No code received');
          router.replace('/sign-in?error=missing_code');
          return;
        }

        setStatus('Exchanging code for session...');
        console.log('[AUTH CALLBACK] Exchanging code for session');
        
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          console.error('[AUTH CALLBACK] Exchange failed:', exErr);
          setStatus('Exchange failed');
          setError(exErr.message);
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        setStatus('Getting user data...');
        console.log('[AUTH CALLBACK] Getting user data');
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[AUTH CALLBACK] No user after exchange');
          setStatus('No user found');
          router.replace('/sign-in?error=no_user');
          return;
        }

        setStatus('Checking venues...');
        console.log('[AUTH CALLBACK] Checking venues for user:', user.id);
        
        const { data: venues, error: venueErr } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('owner_id', user.id)
          .limit(1);

        if (venueErr) {
          console.error('[AUTH CALLBACK] Venue lookup failed:', venueErr);
          setStatus('Venue lookup failed');
          setError(venueErr.message);
          router.replace('/sign-in?error=venue_lookup_failed');
          return;
        }

        setStatus('Redirecting...');
        console.log('[AUTH CALLBACK] Venues found:', venues?.length);
        
        const redirectPath = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
        console.log('[AUTH CALLBACK] Redirecting to:', redirectPath);
        
        router.replace(redirectPath);
      } catch (err: any) {
        console.error('[AUTH CALLBACK] Unexpected error:', err);
        setStatus('Unexpected error');
        setError(err.message);
        router.replace('/sign-in?error=unexpected_error');
      }
    })();

    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('[AUTH CALLBACK] Timeout reached, redirecting to sign-in');
      setStatus('Timeout reached');
      setError('Callback timed out');
      router.replace('/sign-in?error=timeout');
    }, 10000); // 10 second timeout

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
