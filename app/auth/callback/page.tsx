'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const startTime = Date.now();
      console.log('[AUTH DEBUG] ===== AUTHENTICATION CALLBACK STARTED =====');
      console.log('[AUTH DEBUG] Timestamp:', new Date().toISOString());
      console.log('[AUTH DEBUG] Component mounted, starting callback process...');
      
      try {
        // Log environment and configuration
        console.log('[AUTH DEBUG] Environment check:');
        console.log('[AUTH DEBUG] - NODE_ENV:', process.env.NODE_ENV);
        console.log('[AUTH DEBUG] - NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
        console.log('[AUTH DEBUG] - NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
        console.log('[AUTH DEBUG] - NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
        
        // Log current URL and parameters
        console.log('[AUTH DEBUG] URL Analysis:');
        console.log('[AUTH DEBUG] - Full URL:', window.location.href);
        console.log('[AUTH DEBUG] - Pathname:', window.location.pathname);
        console.log('[AUTH DEBUG] - Search params:', window.location.search);
        console.log('[AUTH DEBUG] - Hash:', window.location.hash);
        
        // Log all search parameters
        console.log('[AUTH DEBUG] Search Parameters:');
        const allParams = {};
        searchParams.forEach((value, key) => {
          allParams[key] = value;
        });
        console.log('[AUTH DEBUG] - All params:', allParams);
        
        // Check for error parameters first
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        console.log('[AUTH DEBUG] Error Parameter Check:');
        console.log('[AUTH DEBUG] - error param:', errorParam);
        console.log('[AUTH DEBUG] - error_description param:', errorDescription);
        
        if (errorParam) {
          console.error('[AUTH DEBUG] ❌ OAuth error detected:', errorParam, errorDescription);
          setError(`OAuth Error: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`);
          setTimeout(() => {
            router.push('/sign-in');
          }, 3000);
          return;
        }

        // Check if we have a code parameter
        const code = searchParams.get('code');
        console.log('[AUTH DEBUG] Code Parameter Check:');
        console.log('[AUTH DEBUG] - code param exists:', !!code);
        console.log('[AUTH DEBUG] - code length:', code ? code.length : 0);
        console.log('[AUTH DEBUG] - code preview:', code ? `${code.substring(0, 10)}...` : 'NONE');
        
        if (!code) {
          console.error('[AUTH DEBUG] ❌ No code parameter found');
          setError('No authentication code received. Please try signing in again.');
          setTimeout(() => {
            router.push('/sign-in');
          }, 3000);
          return;
        }

        console.log('[AUTH DEBUG] ✅ Code parameter found, proceeding with session exchange...');
        setDebugInfo('Code found, exchanging for session...');

        // Log Supabase client state
        console.log('[AUTH DEBUG] Supabase Client Check:');
        console.log('[AUTH DEBUG] - supabase object exists:', !!supabase);
        console.log('[AUTH DEBUG] - supabase.auth exists:', !!(supabase && supabase.auth));
        console.log('[AUTH DEBUG] - supabase.auth.exchangeCodeForSession exists:', !!(supabase && supabase.auth && supabase.auth.exchangeCodeForSession));
        
        // Add a timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          console.log(`[AUTH DEBUG] ❌ TIMEOUT REACHED after ${elapsed}ms`);
          setTimeoutReached(true);
          setError('Authentication timed out. Please try signing in again.');
          setTimeout(() => {
            router.push('/sign-in');
          }, 3000);
        }, 15000); // 15 second timeout

        console.log('[AUTH DEBUG] 🔄 Calling supabase.auth.exchangeCodeForSession...');
        const exchangeStartTime = Date.now();
        
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        const exchangeTime = Date.now() - exchangeStartTime;
        console.log(`[AUTH DEBUG] ⏱️ exchangeCodeForSession completed in ${exchangeTime}ms`);

        clearTimeout(timeoutId);

        console.log('[AUTH DEBUG] Exchange Result:');
        console.log('[AUTH DEBUG] - error exists:', !!error);
        console.log('[AUTH DEBUG] - error details:', error);

        if (error) {
          console.error('[AUTH DEBUG] ❌ Auth callback error:', error);
          console.error('[AUTH DEBUG] - Error message:', error.message);
          console.error('[AUTH DEBUG] - Error status:', error.status);
          console.error('[AUTH DEBUG] - Error name:', error.name);
          setError(`Authentication failed: ${error.message}`);
          setTimeout(() => {
            router.push('/sign-in');
          }, 3000);
          return;
        }

        console.log('[AUTH DEBUG] ✅ Auth callback successful!');
        console.log('[AUTH DEBUG] 🔄 Redirecting to dashboard...');
        setDebugInfo('Authentication successful! Redirecting...');
        
        // Success - redirect to dashboard
        router.push('/dashboard');
        
        const totalTime = Date.now() - startTime;
        console.log(`[AUTH DEBUG] ✅ AUTHENTICATION COMPLETED SUCCESSFULLY in ${totalTime}ms`);
        
      } catch (err) {
        const elapsed = Date.now() - startTime;
        console.error(`[AUTH DEBUG] ❌ UNEXPECTED ERROR after ${elapsed}ms:`, err);
        console.error('[AUTH DEBUG] - Error type:', typeof err);
        console.error('[AUTH DEBUG] - Error constructor:', err?.constructor?.name);
        console.error('[AUTH DEBUG] - Error message:', err?.message);
        console.error('[AUTH DEBUG] - Error stack:', err?.stack);
        setError(`An unexpected error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setTimeout(() => {
          router.push('/sign-in');
        }, 3000);
      }
    };

    console.log('[AUTH DEBUG] 🚀 Component useEffect triggered, calling handleCallback...');
    handleCallback();
  }, [router, searchParams]);

  if (error || timeoutReached) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Authentication Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <div className="text-sm text-gray-500 mb-4">Redirecting to sign-in...</div>
          <button 
            onClick={() => router.push('/sign-in')}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Go to Sign In
          </button>
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
  console.log('[AUTH DEBUG] 🎬 AuthCallback component rendering...');
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
