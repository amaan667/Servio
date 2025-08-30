'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function Callback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AUTH CALLBACK] Processing OAuth callback');
        setDebugInfo('Starting callback processing...');
        
        // Get the code from URL parameters
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        
        console.log('[AUTH CALLBACK] URL params:', { code: code?.substring(0, 10) + '...', error });
        setDebugInfo(`Code: ${code ? 'Present' : 'Missing'}, Error: ${error || 'None'}`);
        
        if (error) {
          console.error('[AUTH CALLBACK] OAuth error:', error);
          setError(error);
          setLoading(false);
          return;
        }

        if (!code) {
          console.error('[AUTH CALLBACK] No code found in URL');
          setError('No authorization code found');
          setLoading(false);
          return;
        }

        console.log('[AUTH CALLBACK] Exchanging code for session');
        setDebugInfo('Exchanging code for session...');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Exchange timeout after 10 seconds')), 10000);
        });

        // Exchange the code for a session
        const exchangePromise = supabaseBrowser.auth.exchangeCodeForSession(code);
        
        const { data, error: exchangeError } = await Promise.race([
          exchangePromise,
          timeoutPromise
        ]) as any;
        
        console.log('[AUTH CALLBACK] Exchange result:', { 
          hasData: !!data, 
          hasSession: !!data?.session, 
          error: exchangeError?.message 
        });
        setDebugInfo(`Exchange complete. Session: ${data?.session ? 'Yes' : 'No'}, Error: ${exchangeError?.message || 'None'}`);
        
        if (exchangeError) {
          console.error('[AUTH CALLBACK] Exchange error:', exchangeError);
          setError(exchangeError.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          console.log('[AUTH CALLBACK] Session created successfully, redirecting to dashboard');
          setDebugInfo('Session created, redirecting...');
          router.push('/dashboard');
        } else {
          console.error('[AUTH CALLBACK] No session returned from exchange');
          setError('Failed to create session');
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[AUTH CALLBACK] Unexpected error:', err);
        setError(err.message || 'An unexpected error occurred');
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            {debugInfo && (
              <p className="text-xs text-gray-500 mb-4">Debug: {debugInfo}</p>
            )}
            <button
              onClick={() => router.push('/sign-in')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Signing you in…</p>
        {debugInfo && (
          <p className="text-xs text-gray-500 mt-2">{debugInfo}</p>
        )}
      </div>
    </div>
  );
}
