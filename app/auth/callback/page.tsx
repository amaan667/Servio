'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');

    (async () => {
      try {
        console.log('[AUTH_CALLBACK] Starting callback processing');
        setIsProcessing(true);
        
        if (error) {
          console.error('[AUTH_CALLBACK] OAuth callback error:', error);
          router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
          return;
        }
        if (!code) {
          console.error('[AUTH_CALLBACK] OAuth callback missing code');
          router.replace('/sign-in?error=missing_code');
          return;
        }

        console.log('[AUTH_CALLBACK] Exchanging code for session');
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          console.error('[AUTH_CALLBACK] exchangeCodeForSession failed:', exErr);
          router.replace('/sign-in?error=exchange_failed');
          return;
        }

        console.log('[AUTH_CALLBACK] Getting user after session exchange');
        // Route based on whether venue exists
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('[AUTH_CALLBACK] No user found after session exchange');
          router.replace('/sign-in?error=no_user');
          return;
        }
        
        console.log('[AUTH_CALLBACK] Checking venues for user:', user.id);
        const { data: venues, error: vErr } = await supabase
          .from('venues').select('venue_id').eq('owner_id', user.id).limit(1);
        if (vErr) {
          console.warn('[AUTH_CALLBACK] venue check error (non-fatal):', vErr.message);
        }
        
        const targetRoute = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
        console.log('[AUTH_CALLBACK] Redirecting to:', targetRoute);
        router.replace(targetRoute);
      } catch (e: any) {
        console.error('[AUTH_CALLBACK] Callback fatal:', e);
        setIsProcessing(false);
        // Don't redirect immediately, let the user see the error
      }
    })();
  }, [params, router]);

  // Show loading state while processing
  if (isProcessing) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Completing sign‑in…</p>
        </div>
      </div>
    );
  }

  // Show error state if processing failed
  return (
    <div className="min-h-[50vh] grid place-items-center">
      <div className="text-center">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign-in Failed</h2>
        <p className="text-gray-600 mb-4">There was a problem completing your sign-in.</p>
        <button
          onClick={() => router.replace('/sign-in')}
          className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] grid place-items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
