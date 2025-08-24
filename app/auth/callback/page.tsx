'use client';

import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured, clearInvalidSession } from '@/lib/supabaseClient';

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');

    (async () => {
      try {
        console.log('[AUTH_CALLBACK] Starting callback processing');
        setIsProcessing(true);
        
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          console.error('[AUTH_CALLBACK] Supabase not configured');
          router.replace('/sign-in?error=service_unavailable');
          return;
        }
        
        // Handle OAuth errors
        if (errorParam) {
          console.error('[AUTH_CALLBACK] OAuth callback error:', errorParam, errorDescription);
          
          // Clear any invalid sessions
          await clearInvalidSession();
          
          router.replace(`/sign-in?error=${encodeURIComponent(errorParam)}&message=${encodeURIComponent(errorDescription || '')}`);
          return;
        }

        // If no code, check if we already have a session
        if (!code) {
          console.log('[AUTH_CALLBACK] No code in URL, checking for existing session');
          
          try {
            const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
            
            if (sessionErr) {
              console.warn('[AUTH_CALLBACK] getSession error:', sessionErr.message);
              
              // Handle refresh token errors
              if (sessionErr.message?.includes('refresh_token_not_found') || 
                  sessionErr.message?.includes('Invalid Refresh Token')) {
                console.warn('[AUTH_CALLBACK] Clearing invalid session');
                await clearInvalidSession();
                router.replace('/sign-in?error=invalid_session');
                return;
              }
            }
            
            if (sessionData?.session?.user) {
              const userId = sessionData.session.user.id;
              console.log('[AUTH_CALLBACK] Session found, checking venues for:', userId);
              
              const { data: venues, error: vErr } = await supabase
                .from('venues')
                .select('venue_id')
                .eq('owner_id', userId)
                .limit(1);
                
              if (vErr) {
                console.warn('[AUTH_CALLBACK] Venue check error:', vErr.message);
              }
              
              const targetRoute = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
              console.log('[AUTH_CALLBACK] Redirecting to:', targetRoute);
              router.replace(targetRoute);
              return;
            }
          } catch (e) {
            console.error('[AUTH_CALLBACK] Session check error:', e);
          }
          
          // No code and no session
          console.error('[AUTH_CALLBACK] No code and no session');
          router.replace('/sign-in?error=missing_code');
          return;
        }

        // We have a code - the server-side API route should handle the exchange
        // We should NOT try to exchange it client-side in PKCE flow
        console.log('[AUTH_CALLBACK] Code present, waiting for session from server exchange');
        
        // Give the server-side exchange a moment to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if session was created by server-side exchange
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        
        if (sessionErr) {
          console.error('[AUTH_CALLBACK] Session error after server exchange:', sessionErr.message);
          
          if (sessionErr.message?.includes('refresh_token_not_found') || 
              sessionErr.message?.includes('Invalid Refresh Token')) {
            await clearInvalidSession();
          }
          
          router.replace('/sign-in?error=exchange_failed');
          return;
        }
        
        if (!sessionData?.session?.user) {
          console.error('[AUTH_CALLBACK] No session after server exchange');
          router.replace('/sign-in?error=no_session');
          return;
        }
        
        // Session established, check venues
        const userId = sessionData.session.user.id;
        console.log('[AUTH_CALLBACK] Session established, checking venues for:', userId);
        
        const { data: venues, error: vErr } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('owner_id', userId)
          .limit(1);
          
        if (vErr) {
          console.warn('[AUTH_CALLBACK] Venue check error:', vErr.message);
        }
        
        const targetRoute = venues?.length ? `/dashboard/${venues[0].venue_id}` : '/complete-profile';
        console.log('[AUTH_CALLBACK] Redirecting to:', targetRoute);
        router.replace(targetRoute);
        
      } catch (e: any) {
        console.error('[AUTH_CALLBACK] Fatal error:', e);
        setError(e?.message || 'An unexpected error occurred');
        setIsProcessing(false);
        
        // Handle refresh token errors
        if (e?.message?.includes('refresh_token_not_found') || 
            e?.message?.includes('Invalid Refresh Token')) {
          await clearInvalidSession();
          router.replace('/sign-in?error=invalid_session');
        }
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
