'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Import supabase browser directly to avoid lazy loading issues
import { supabaseBrowser, clearSupabaseAuth } from '@/lib/supabase';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Debug logging function
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [...prev, logEntry]);
  }, []);

  // Detect if we're on mobile
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = [
      'android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 
      'iemobile', 'opera mini', 'mobile', 'tablet'
    ];
    return mobileKeywords.some(keyword => userAgent.includes(keyword)) ||
           window.innerWidth <= 768;
  };

  // Clear auth state function
  const clearAuthState = async () => {
    try {
      addDebugLog('[AUTH CALLBACK] Clearing auth state...');
      await clearSupabaseAuth();
      addDebugLog('[AUTH CALLBACK] Auth state cleared successfully');
    } catch (err: unknown) {
      addDebugLog(`[AUTH CALLBACK] Error clearing auth state: ${err}`);
    }
  };

  useEffect(() => {
    addDebugLog('[AUTH CALLBACK] Component mounted');
    addDebugLog(`[AUTH CALLBACK] Platform: ${isMobile() ? 'Mobile' : 'Desktop'}`);
    addDebugLog(`[AUTH CALLBACK] User Agent: ${typeof window !== 'undefined' ? navigator.userAgent : 'SSR'}`);
    addDebugLog(`[AUTH CALLBACK] Current URL: ${typeof window !== 'undefined' ? window.location.href : 'SSR'}`);
    
    // Remove artificial timeout - let real auth flow handle errors

    const handleCallback = async () => {
      try {
        addDebugLog('[AUTH CALLBACK] ===== STARTING CALLBACK PROCESS =====');
        addDebugLog('[AUTH CALLBACK] Processing OAuth callback');
        addDebugLog(`[AUTH CALLBACK] Platform: ${isMobile() ? 'Mobile' : 'Desktop'}`);
        
        // Get the code from URL parameters
        const code = searchParams?.get('code');
        const error = searchParams?.get('error');
        const state = searchParams?.get('state');
        
        addDebugLog(`[AUTH CALLBACK] URL params: ${JSON.stringify({ 
          code: code?.substring(0, 10) + '...', 
          error,
          state: state?.substring(0, 10) + '...',
          hasCode: !!code,
          hasError: !!error,
          hasState: !!state
        })}`);

        if (error) {
          addDebugLog(`[AUTH CALLBACK] OAuth error in URL params: ${error}`);
          setError(`OAuth error: ${error}`);
          setLoading(false);
          return;
        }

        // Handle the case where we have state but no code (OAuth state mismatch)
        if (state && !code) {
          addDebugLog('[AUTH CALLBACK] State parameter present but no code - likely OAuth state mismatch');
          await clearAuthState();
          setError('OAuth state mismatch. Please try signing in again.');
          setLoading(false);
          return;
        }

        if (!code) {
          addDebugLog('[AUTH CALLBACK] No code found in URL parameters');
          addDebugLog(`[AUTH CALLBACK] All search params: ${JSON.stringify(searchParams ? Object.fromEntries(searchParams.entries()) : { /* Empty */ })}`);
          setError('No authorization code found in URL parameters');
          setLoading(false);
          return;
        }

        addDebugLog('[AUTH CALLBACK] Code found, checking existing session...');

        // Check if we have a valid session already
        const { data: { session: existingSession }, error: sessionError } = await supabaseBrowser().auth.getSession();
        
        addDebugLog(`[AUTH CALLBACK] Session check result: ${JSON.stringify({
          hasSession: !!existingSession,
          sessionError: sessionError?.message,
          sessionExpiry: existingSession?.expires_at
        })}`);
        
        if (sessionError) {
          addDebugLog(`[AUTH CALLBACK] Error checking session: ${sessionError.message}`);
        }
        
        if (existingSession) {
          addDebugLog('[AUTH CALLBACK] Session already exists, fetching primary venue...');
          
          // Fetch primary venue to redirect to venue-specific dashboard
          const { data: venues, error: venueError } = await supabaseBrowser()
            .from('venues')
            .select('venue_id')
            .eq('owner_user_id', existingSession.user.id)
            .order('created_at', { ascending: true })
            .limit(1);
          
          if (venueError || !venues || venues.length === 0) {
            addDebugLog('[AUTH CALLBACK] No venue found or error, redirecting to home');
            router.push('/');
            return;
          }
          
          const primaryVenue = venues[0];
          if (!primaryVenue) {
            addDebugLog('[AUTH CALLBACK] No primary venue, redirecting to home');
            router.push('/');
            return;
          }
          
          addDebugLog(`[AUTH CALLBACK] Redirecting to dashboard for venue: ${primaryVenue.venue_id}`);
          router.push(`/dashboard/${primaryVenue.venue_id}`);
          return;
        }

        addDebugLog('[AUTH CALLBACK] No existing session, proceeding with code exchange');
        addDebugLog('[AUTH CALLBACK] Exchanging code for session...');
        
        // Remove artificial timeout - let real auth exchange handle timing

        addDebugLog('[AUTH CALLBACK] Starting code exchange with Supabase...');
        
        // Exchange the code for a session
        const { data, error: exchangeError } = await supabaseBrowser().auth.exchangeCodeForSession(code);
        
        addDebugLog(`[AUTH CALLBACK] Exchange completed: ${JSON.stringify({ 
          hasData: !!data, 
          hasSession: !!data?.session, 
          hasUser: !!data?.user,
          error: exchangeError?.message,
          errorCode: exchangeError?.status,
          sessionExpiry: data?.session?.expires_at,
          userId: data?.user?.id
        })}`);

        if (exchangeError) {
          addDebugLog(`[AUTH CALLBACK] Exchange error details: ${JSON.stringify({
            message: exchangeError.message,
            status: exchangeError.status,
            name: exchangeError.name,
            code: exchangeError.code
          })}`);
          
          // Handle specific PKCE errors
          if (exchangeError.message?.includes('pkce') || 
              exchangeError.message?.includes('verifier') || 
              exchangeError.message?.includes('code verifier') ||
              exchangeError.code === 'validation_failed') {
            addDebugLog('[AUTH CALLBACK] PKCE error detected, clearing auth state');
            await clearAuthState();
            setError('Authentication failed due to security verification. Please try again.');
            setLoading(false);
            return;
          }
          
          // Handle refresh token errors
          if (exchangeError.code === 'refresh_token_not_found' || 
              exchangeError.message?.includes('refresh token')) {
            addDebugLog('[AUTH CALLBACK] Refresh token error detected');
            await clearAuthState();
            setError('Your session has expired. Please try again.');
            setLoading(false);
            return;
          }
          
          // Handle network errors
          if (exchangeError.message?.includes('network') || 
              exchangeError.message?.includes('fetch') ||
              exchangeError.message?.includes('timeout')) {
            addDebugLog('[AUTH CALLBACK] Network error detected');
            setError('Network error. Please check your connection and try again.');
            setLoading(false);
            return;
          }
          
          // If it's not a specific error, try a fallback approach
          addDebugLog('[AUTH CALLBACK] Attempting fallback authentication...');
          
          try {
            // Clear unknown existing auth state
            await clearAuthState();
            
            // Remove artificial delay - proceed immediately
            
            // Try the exchange again
            addDebugLog('[AUTH CALLBACK] Retrying code exchange...');
            const { data: retryData, error: retryError } = await supabaseBrowser().auth.exchangeCodeForSession(code);
            
            addDebugLog(`[AUTH CALLBACK] Retry result: ${JSON.stringify({
              hasData: !!retryData,
              hasSession: !!retryData?.session,
              error: retryError?.message
            })}`);
            
            if (retryError) {
              addDebugLog(`[AUTH CALLBACK] Fallback exchange also failed: ${retryError.message}`);
              setError(`Authentication failed: ${retryError.message}`);
              setLoading(false);
              return;
            }
            
            if (retryData?.session) {
              addDebugLog('[AUTH CALLBACK] Fallback authentication successful, fetching primary venue...');
              
              // Fetch primary venue to redirect to venue-specific dashboard
              const { data: venues, error: venueError } = await supabaseBrowser()
                .from('venues')
                .select('venue_id')
                .eq('owner_user_id', retryData.session.user.id)
                .order('created_at', { ascending: true })
                .limit(1);
              
              if (venueError || !venues || venues.length === 0) {
                addDebugLog('[AUTH CALLBACK] No venue found or error, redirecting to home');
                router.push('/');
                return;
              }
              
              const primaryVenue = venues[0];
              if (!primaryVenue) {
                addDebugLog('[AUTH CALLBACK] No primary venue, redirecting to home');
                router.push('/');
                return;
              }
              
              addDebugLog(`[AUTH CALLBACK] Redirecting to dashboard for venue: ${primaryVenue.venue_id}`);
              router.push(`/dashboard/${primaryVenue.venue_id}`);
              return;
            }
          } catch (fallbackErr: unknown) {
            const fallbackError = fallbackErr as Error;
            addDebugLog(`[AUTH CALLBACK] Fallback authentication error: ${fallbackError.message}`);
            setError(`Authentication failed: ${fallbackError.message}`);
            setLoading(false);
            return;
          }
          
          setError(`Exchange failed: ${exchangeError.message}`);
          setLoading(false);
          return;
        }

        if (data?.session) {
          addDebugLog('[AUTH CALLBACK] Session created successfully, fetching primary venue...');
          addDebugLog(`[AUTH CALLBACK] Session details: ${JSON.stringify({
            userId: data.session.user.id,
            expiresAt: data.session.expires_at,
            accessToken: data.session.access_token ? 'present' : 'missing'
          })}`);
          
          // Fetch primary venue to redirect to venue-specific dashboard
          const { data: venues, error: venueError } = await supabaseBrowser()
            .from('venues')
            .select('venue_id')
            .eq('owner_user_id', data.session.user.id)
            .order('created_at', { ascending: true })
            .limit(1);
          
          if (venueError || !venues || venues.length === 0) {
            addDebugLog('[AUTH CALLBACK] No venue found or error, redirecting to home');
            router.push('/');
            return;
          }
          
          const primaryVenue = venues[0];
          if (!primaryVenue) {
            addDebugLog('[AUTH CALLBACK] No primary venue, redirecting to home');
            router.push('/');
            return;
          }
          
          addDebugLog(`[AUTH CALLBACK] Redirecting to dashboard for venue: ${primaryVenue.venue_id}`);
          router.push(`/dashboard/${primaryVenue.venue_id}`);
        } else {
          addDebugLog('[AUTH CALLBACK] No session returned from exchange');
          addDebugLog(`[AUTH CALLBACK] Data received: ${JSON.stringify(data)}`);
          setError('Failed to create session - no session data returned');
          setLoading(false);
        }
      } catch (err: unknown) {
        const error = err as Error;
        addDebugLog(`[AUTH CALLBACK] Unexpected error: ${error.message}`);
        addDebugLog(`[AUTH CALLBACK] Error details: ${JSON.stringify({
          message: error.message,
          name: error.name,
          stack: error.stack
        })}`);
        
        // Handle timeout errors
        if (error.message?.includes('timeout')) {
          addDebugLog('[AUTH CALLBACK] Timeout error detected');
          setError('Authentication timed out. Please try signing in again.');
          setLoading(false);
          return;
        }
        
        setError(error.message || 'An unexpected error occurred during authentication');
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, addDebugLog, router, error, loading]);

  // Remove blocking loading state - render content immediately
  // Auth state will be handled by the auth provider

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">
              Authentication Error
            </h1>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Reload Page
              </button>
            </div>
            {debugLogs.length > 0 && (
              <div className="mt-4 text-xs text-gray-900 text-left max-h-32 overflow-y-auto">
                <p className="font-medium mb-1">Debug Logs:</p>
                {debugLogs.slice(-5).map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-4">
            Signing you in...
          </h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">
            Please wait while we complete your sign-in.
          </p>
          {debugLogs.length > 0 && (
            <div className="mt-4 text-xs text-gray-900 text-left max-h-32 overflow-y-auto">
              <p className="font-medium mb-1">Debug Logs:</p>
              {debugLogs.slice(-5).map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackContent />
    </Suspense>
  );
}
