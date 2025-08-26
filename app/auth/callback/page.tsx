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
        console.log('[AUTH DEBUG] Code:', code);
        console.log('[AUTH DEBUG] Current URL:', window.location.href);
        const supabase = createClient();
        
        // Add a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('[AUTH DEBUG] Auth callback timed out');
          router.replace('/sign-in?error=timeout');
        }, 15000); // 15 second timeout
        
        // Try the new exchangeCodeForSession method first
        try {
          console.log('[AUTH DEBUG] Attempting code exchange with code parameter');
          const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          clearTimeout(timeoutId);
          
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
          clearTimeout(timeoutId);
          console.error('[AUTH DEBUG] exchangeCodeForSession failed, trying fallback:', exErr);
          
          // Fallback: try the old method with queryParams
          const url = new URL(window.location.href);
          console.log('[AUTH DEBUG] Attempting fallback with queryParams:', Object.fromEntries(url.searchParams.entries()));
          
          const fallbackTimeoutId = setTimeout(() => {
            console.error('[AUTH DEBUG] Fallback auth callback timed out');
            router.replace('/sign-in?error=fallback_timeout');
          }, 10000);
          
          try {
            const { data, error: fallbackErr } = await supabase.auth.exchangeCodeForSession({
              queryParams: url.searchParams,
            });
            
            clearTimeout(fallbackTimeoutId);
            
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
          } catch (fallbackExErr: any) {
            clearTimeout(fallbackTimeoutId);
            console.error('[AUTH DEBUG] Fallback exception:', fallbackExErr);
            router.replace('/sign-in?error=fallback_exception');
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
      <div className="text-center">
        <p className="text-sm text-gray-600 mb-4">Completing sign‑in…</p>
        <button
          onClick={() => {
            console.log('[AUTH DEBUG] Manual retry clicked');
            window.location.reload();
          }}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Click here if this takes too long
        </button>
      </div>
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
