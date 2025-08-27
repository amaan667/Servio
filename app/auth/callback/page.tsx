'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AUTH DEBUG] ===== AUTHENTICATION CALLBACK STARTED =====');
      console.log('[AUTH DEBUG] URL:', window.location.href);
      
      try {
        // Check for error parameters first
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (errorParam) {
          console.error('[AUTH DEBUG] ❌ OAuth error:', errorParam, errorDescription);
          setError(`OAuth Error: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`);
          setTimeout(() => router.push('/sign-in'), 3000);
          return;
        }

        // Check if we have a code parameter
        const code = searchParams.get('code');
        if (!code) {
          console.error('[AUTH DEBUG] ❌ No code parameter found');
          setError('No authentication code received. Please try signing in again.');
          setTimeout(() => router.push('/sign-in'), 3000);
          return;
        }

        console.log('[AUTH DEBUG] ✅ Code found, exchanging for session...');
        setDebugInfo('Code found, exchanging for session...');

        // Exchange code for session - this should be fast
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);

        if (error) {
          console.error('[AUTH DEBUG] ❌ Exchange error:', error);
          setError(`Authentication failed: ${error.message}`);
          setTimeout(() => router.push('/sign-in'), 3000);
          return;
        }

        if (!data || !data.session) {
          console.error('[AUTH DEBUG] ❌ No session received');
          setError('Authentication completed but no session was created.');
          setTimeout(() => router.push('/sign-in'), 3000);
          return;
        }

        console.log('[AUTH DEBUG] ✅ Authentication successful!');
        console.log('[AUTH DEBUG] User ID:', data.session.user.id);
        setDebugInfo('Authentication successful! Redirecting...');
        
        // Success - redirect to dashboard immediately
        router.push('/dashboard');
        
      } catch (err) {
        console.error('[AUTH DEBUG] ❌ Unexpected error:', err);
        setError(`An unexpected error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setTimeout(() => router.push('/sign-in'), 3000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Authentication Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <div className="text-sm text-gray-500 mb-4">Redirecting to sign-in...</div>
          <div className="space-y-2">
            <button 
              onClick={() => router.push('/sign-in')}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 mr-2"
            >
              Go to Sign In
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Retry Authentication
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <div className="text-gray-600">Completing sign-in...</div>
        {debugInfo && (
          <div className="text-sm text-gray-500 mt-2">{debugInfo}</div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
