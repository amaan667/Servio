"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AUTH DEBUG] OAuth callback page: processing callback');
        
        const supabase = createClient();
        
        // Get the authorization code from URL params
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        
        console.log('[AUTH DEBUG] OAuth callback params:', { 
          hasCode: !!code, 
          hasError: !!error,
          error: error 
        });

        if (error) {
          console.error('[AUTH DEBUG] OAuth error in callback:', error);
          setError(error);
          setLoading(false);
          return;
        }

        if (!code) {
          console.error('[AUTH DEBUG] No authorization code in callback');
          setError('missing_code');
          setLoading(false);
          return;
        }

        // Exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        console.log('[AUTH DEBUG] Exchange result:', { 
          hasData: !!data, 
          hasSession: !!data?.session,
          userId: data?.session?.user?.id,
          error: exchangeError?.message 
        });

        if (exchangeError) {
          console.error('[AUTH DEBUG] Exchange failed:', exchangeError);
          setError('exchange_failed');
          setLoading(false);
          return;
        }

        if (!data.session) {
          console.error('[AUTH DEBUG] No session after exchange');
          setError('no_session');
          setLoading(false);
          return;
        }

        console.log('[AUTH DEBUG] OAuth callback successful, redirecting to dashboard');
        
        // Check if user has venues
        const { data: venues } = await supabase
          .from('venues')
          .select('venue_id')
          .eq('owner_id', data.session.user.id)
          .limit(1);

        if (venues && venues.length > 0) {
          // User has venues, redirect to their first venue
          router.replace(`/dashboard/${venues[0].venue_id}`);
        } else {
          // User has no venues, redirect to complete profile
          router.replace('/complete-profile');
        }

      } catch (err: any) {
        console.error('[AUTH DEBUG] OAuth callback error:', err);
        setError('oauth_error');
        setLoading(false);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Finalizing your sign-in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-lg font-semibold">Sign-in Failed</p>
          </div>
          <p className="text-gray-600 mb-4">
            {error === 'exchange_failed' && 'Sign-in failed while finalizing session.'}
            {error === 'missing_code' && 'Missing authorization code in callback.'}
            {error === 'no_session' && 'Signed in, but no session returned.'}
            {error === 'oauth_error' && 'Authentication failed. Please try again.'}
            {!['exchange_failed', 'missing_code', 'no_session', 'oauth_error'].includes(error) && error}
          </p>
          <button
            onClick={() => router.push('/sign-in')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
