'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/sb-client';

function AuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const urlError = params?.get('error');
    
    if (urlError) {
      console.error('[AUTH] OAuth callback error:', urlError);
      setError(getErrorMessage(urlError));
      setIsProcessing(false);
      return;
    }

    const code = params?.get('code');
    if (!code) {
      console.error('[AUTH] OAuth callback missing code');
      setError('Authentication code missing. Please try signing in again.');
      setIsProcessing(false);
      return;
    }

    // Wait for automatic session detection and processing
    // Supabase client has detectSessionInUrl: true, so it will automatically
    // handle the code exchange when the component mounts
    const processCallback = async () => {
      try {
        console.log('[AUTH] Waiting for automatic session detection...');
        
        // Wait for session to be established (with timeout)
        const session = await waitForSession(10000); // 10 second timeout
        
        if (!session?.user) {
          console.error('[AUTH] No session or user after auth callback');
          setError('Authentication failed. Please try signing in again.');
          setIsProcessing(false);
          return;
        }

        console.log('[AUTH] Session established, checking venue...');
        
        // Route based on whether venue exists (with timeout)
        const venues = await fetchVenuesWithTimeout(session.user.id, 5000); // 5 second timeout
        
        const redirectPath = venues?.length 
          ? `/dashboard/${venues[0].venue_id}` 
          : '/complete-profile';
          
        console.log('[AUTH] Redirecting to:', redirectPath);
        router.replace(redirectPath);
        
      } catch (e: any) {
        console.error('[AUTH] Callback processing failed:', e);
        setError(e.message || 'Sign-in failed. Please try again.');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [params, router]);

  // Helper function to wait for session with timeout
  const waitForSession = (timeoutMs: number) => {
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Session establishment timed out. Please try signing in again.'));
      }, timeoutMs);

      const checkSession = async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) {
            clearTimeout(timeout);
            reject(new Error(`Authentication failed: ${error.message}`));
            return;
          }
          
          if (session?.user) {
            clearTimeout(timeout);
            resolve(session);
            return;
          }
          
          // If no session yet, check again in 100ms
          setTimeout(checkSession, 100);
        } catch (err: any) {
          clearTimeout(timeout);
          reject(new Error(`Authentication error: ${err.message}`));
        }
      };

      checkSession();
    });
  };

  // Helper function to fetch venues with timeout
  const fetchVenuesWithTimeout = async (userId: string, timeoutMs: number) => {
    return new Promise<any[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Venue lookup timed out. Please try refreshing the page.'));
      }, timeoutMs);

      const fetchVenues = async () => {
        try {
          const { data: venues, error: vErr } = await supabase
            .from('venues')
            .select('venue_id')
            .eq('owner_id', userId)
            .limit(1);
            
          clearTimeout(timeout);
          if (vErr) {
            console.warn('[AUTH] venue check error (non-fatal):', vErr.message);
            // Don't reject for venue errors, just return empty array
            resolve([]);
          } else {
            resolve(venues || []);
          }
        } catch (err: any) {
          clearTimeout(timeout);
          reject(new Error(`Venue lookup failed: ${err.message}`));
        }
      };

      fetchVenues();
    });
  };

  // Helper function to get user-friendly error messages
  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'access_denied':
        return 'Sign-in was cancelled. Please try again if you want to continue.';
      case 'server_error':
        return 'Server error occurred during sign-in. Please try again.';
      case 'temporarily_unavailable':
        return 'Sign-in service is temporarily unavailable. Please try again later.';
      case 'invalid_request':
        return 'Invalid sign-in request. Please try again.';
      case 'unsupported_response_type':
        return 'Unsupported authentication method. Please contact support.';
      default:
        return `Sign-in failed: ${errorCode}. Please try again.`;
    }
  };

  const handleRetry = () => {
    router.replace('/sign-in');
  };

  if (error) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <span className="text-red-600 text-xl font-semibold">!</span>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Sign-in Failed</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Completing sign‑in…</p>
        </div>
      </div>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[50vh] grid place-items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
