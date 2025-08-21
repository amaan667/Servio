'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('Starting...');

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');

    console.log('[AUTH] Callback page loaded', { hasCode: !!code, hasError: !!error });

    (async () => {
      try {
        if (error) {
          console.error('[AUTH] OAuth error:', error);
          setStatus('OAuth error occurred');
          router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
          return;
        }
        if (!code) {
          console.error('[AUTH] No code in callback');
          setStatus('No authentication code received');
          router.replace('/sign-in?error=missing_code');
          return;
        }

        console.log('[AUTH] Starting PKCE exchange on client');
        setStatus('Exchanging authentication code...');
        
        // Do PKCE exchange on the client — has access to code_verifier
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          console.error('[AUTH] exchange failed:', exchangeError);
          setStatus('Authentication exchange failed');
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        console.log('[AUTH] PKCE exchange successful', { session: !!data.session });
        setStatus('Authentication successful, checking user...');

        // Route the user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error('[AUTH] User lookup failed:', userError);
          setStatus('User lookup failed');
          router.replace('/sign-in?error=user_lookup_failed');
          return;
        }
        
        if (!user) {
          console.error('[AUTH] No user after exchange');
          setStatus('No user found after authentication');
          router.replace('/sign-in?error=no_user_after_exchange');
          return;
        }

        console.log('[AUTH] User authenticated:', user.id);
        setStatus('Checking venue access...');

        // Try to get venues with error handling
        let venues = null;
        let vErr = null;
        
        try {
          const result = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: true })
            .limit(1);
          
          venues = result.data;
          vErr = result.error;
        } catch (venueError) {
          console.error('[AUTH] Venue query exception:', venueError);
          vErr = venueError;
        }

        if (vErr) {
          console.error('[AUTH] Venues lookup failed:', vErr);
          setStatus('Venue lookup failed');
          // For now, redirect to complete-profile as fallback
          console.log('[AUTH] Falling back to complete-profile due to venue lookup error');
          router.replace('/complete-profile');
          return;
        }

        if (!venues?.length) {
          console.log('[AUTH] New user, redirecting to complete profile');
          setStatus('New user, redirecting to profile setup...');
          router.replace('/complete-profile');
        } else {
          console.log('[AUTH] Existing user, redirecting to dashboard');
          setStatus('Redirecting to dashboard...');
          router.replace(`/dashboard/${venues[0].venue_id}`);
        }
      } catch (err) {
        console.error('[AUTH] Unexpected error in callback:', err);
        setStatus('Unexpected error occurred');
        // Fallback to complete-profile instead of sign-in
        console.log('[AUTH] Falling back to complete-profile due to unexpected error');
        router.replace('/complete-profile');
      }
    })();

    // Add a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.error('[AUTH] Callback timeout - redirecting to complete-profile');
      router.replace('/complete-profile');
    }, 30000); // 30 seconds

    return () => clearTimeout(timeout);
  }, [params, router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-gray-600">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p>Completing sign-in…</p>
        <p className="text-sm text-gray-500 mt-2">{status}</p>
        <button 
          onClick={() => router.replace('/complete-profile')}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Continue to Profile Setup
        </button>
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
