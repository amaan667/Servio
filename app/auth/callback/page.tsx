'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      
      console.log('[AUTH DEBUG] Client callback received:', { hasCode: !!code, error });
      
      if (error) {
        console.log('[AUTH DEBUG] OAuth error in client callback:', error);
        setError(`OAuth error: ${error}`);
        setStatus('error');
        return;
      }
      
      if (!code) {
        console.log('[AUTH DEBUG] No code received in client callback');
        setError('No authorization code received');
        setStatus('error');
        return;
      }
      
      try {
        console.log('[AUTH DEBUG] Exchanging code for session');
        
        // Exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.log('[AUTH DEBUG] Exchange error:', exchangeError);
          setError(`Authentication failed: ${exchangeError.message}`);
          setStatus('error');
          return;
        }
        
        if (!data.session) {
          console.log('[AUTH DEBUG] No session created after exchange');
          setError('Authentication failed: No session created');
          setStatus('error');
          return;
        }
        
        console.log('[AUTH DEBUG] Authentication successful, redirecting to home page');
        setStatus('success');
        
        // Redirect to home page after successful authentication
        // The navigation will show "Dashboard" button for signed-in users
        setTimeout(() => {
          router.replace('/');
        }, 1000);
        
      } catch (err: any) {
        console.log('[AUTH DEBUG] Unexpected error during callback:', err);
        setError(`Unexpected error: ${err.message}`);
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/sign-in')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Successful!</h2>
        <p className="text-gray-600">Redirecting to home page...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
