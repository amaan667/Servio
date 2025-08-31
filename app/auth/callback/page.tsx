'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function Callback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Debug logging function
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    // Only update debug logs in useEffect to avoid re-renders
  }, []);

  // Detect if we're on mobile
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  useEffect(() => {
    addDebugLog('[AUTH CALLBACK] Component mounted');
    addDebugLog(`[AUTH CALLBACK] Platform: ${isMobile() ? 'Mobile' : 'Desktop'}`);
    addDebugLog(`[AUTH CALLBACK] User Agent: ${typeof window !== 'undefined' ? navigator.userAgent : 'SSR'}`);
    addDebugLog(`[AUTH CALLBACK] Current URL: ${typeof window !== 'undefined' ? window.location.href : 'SSR'}`);
    
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      addDebugLog('[AUTH CALLBACK] TIMEOUT ERROR: 30 second timeout reached');
      addDebugLog(`[AUTH CALLBACK] Current state - Error: ${error}, Loading: ${loading}`);
      setError('Authentication timed out. Please try signing in again.');
      setLoading(false);
    }, 30000); // 30 seconds timeout

    const handleCallback = async () => {
      try {
        addDebugLog('[AUTH CALLBACK] ===== STARTING CALLBACK PROCESS =====');
        addDebugLog('[AUTH CALLBACK] Processing OAuth callback');
        addDebugLog(`[AUTH CALLBACK] Platform: ${isMobile() ? 'Mobile' : 'Desktop'}`);
        
        // Get the code from URL parameters
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');
        
        addDebugLog(`[AUTH CALLBACK] URL params: ${JSON.stringify({ 
          code: code?.substring(0, 10) + '...', 
          error,
          state: state?.substring(0, 10) + '...',
          hasCode: !!code,
          hasError: !!error,
          hasState: !!state,
          fullCode: code,
          fullState: state
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
          addDebugLog('[AUTH CALLBACK] Clearing auth state and redirecting to sign-in');
          
          try {
            // Clear any existing auth state
            await supabaseBrowser().auth.signOut();
            
            // Clear storage
            const authKeys = Object.keys(localStorage).filter(k => 
              k.includes('auth') || k.includes('supabase') || k.includes('sb-')
            );
            addDebugLog(`[AUTH CALLBACK] Clearing localStorage keys: ${authKeys.join(', ')}`);
            authKeys.forEach(key => localStorage.removeItem(key));
            
            const sessionAuthKeys = Object.keys(sessionStorage).filter(k => 
              k.includes('auth') || k.includes('supabase') || k.includes('sb-')
            );
            addDebugLog(`[AUTH CALLBACK] Clearing sessionStorage keys: ${sessionAuthKeys.join(', ')}`);
            sessionAuthKeys.forEach(key => sessionStorage.removeItem(key));
          } catch (err) {
            addDebugLog(`[AUTH CALLBACK] Error clearing storage: ${err}`);
          }
          
          setError('OAuth state mismatch. Please try signing in again.');
          setLoading(false);
          return;
        }

        if (!code) {
          addDebugLog('[AUTH CALLBACK] No code found in URL parameters');
          addDebugLog(`[AUTH CALLBACK] All search params: ${JSON.stringify(Object.fromEntries(searchParams.entries()))}`);
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
          addDebugLog('[AUTH CALLBACK] Session already exists, redirecting to dashboard');
          router.push('/dashboard');
          return;
        }

        addDebugLog('[AUTH CALLBACK] No existing session, proceeding with code exchange');
        addDebugLog('[AUTH CALLBACK] Exchanging code for session...');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            addDebugLog('[AUTH CALLBACK] EXCHANGE TIMEOUT: 15 second timeout reached');
            reject(new Error('Exchange timeout after 15 seconds'));
          }, 15000);
        });

        addDebugLog('[AUTH CALLBACK] Starting code exchange with Supabase...');
        
        // Exchange the code for a session
        const exchangePromise = supabaseBrowser().auth.exchangeCodeForSession(code);
        
        const { data, error: exchangeError } = await Promise.race([
          exchangePromise,
          timeoutPromise
        ]) as any;
        
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
            code: exchangeError.code,
            stack: exchangeError.stack
          })}`);
          
          // Handle specific PKCE errors
          if (exchangeError.message?.includes('pkce') || 
              exchangeError.message?.includes('verifier') || 
              exchangeError.message?.includes('code verifier') ||
              exchangeError.code === 'validation_failed') {
            addDebugLog('[AUTH CALLBACK] PKCE error detected, attempting to clear auth state and retry');
            
            // Clear auth state and redirect to sign-in
            await supabaseBrowser().auth.signOut();
            
            // Clear any remaining auth-related storage
            try {
              const authKeys = Object.keys(localStorage).filter(k => 
                k.includes('auth') || k.includes('supabase') || k.includes('sb-')
              );
              addDebugLog(`[AUTH CALLBACK] Clearing localStorage keys: ${authKeys.join(', ')}`);
              authKeys.forEach(key => localStorage.removeItem(key));
              
              const sessionAuthKeys = Object.keys(sessionStorage).filter(k => 
                k.includes('auth') || k.includes('supabase') || k.includes('sb-')
              );
              addDebugLog(`[AUTH CALLBACK] Clearing sessionStorage keys: ${sessionAuthKeys.join(', ')}`);
              sessionAuthKeys.forEach(key => sessionStorage.removeItem(key));
            } catch (err) {
              addDebugLog(`[AUTH CALLBACK] Error clearing storage: ${err}`);
            }
            
            setTimeout(() => {
              router.push('/sign-in?error=pkce_error');
            }, 1000);
            return;
          }
          
          // Handle refresh token errors
          if (exchangeError.code === 'refresh_token_not_found' || 
              exchangeError.message?.includes('refresh token')) {
            addDebugLog('[AUTH CALLBACK] Refresh token error detected, redirecting to sign-in');
            
            // Clear auth state
            await supabaseBrowser().auth.signOut();
            
            setTimeout(() => {
              router.push('/sign-in?error=refresh_token_error');
            }, 1000);
            return;
          }
          
          // If it's not a PKCE error, try a fallback approach
          addDebugLog('[AUTH CALLBACK] Attempting fallback authentication...');
          
          try {
            // Clear any existing auth state
            await supabaseBrowser().auth.signOut();
            
            // Wait a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            
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
              addDebugLog('[AUTH CALLBACK] Fallback authentication successful');
              setTimeout(() => {
                router.push('/dashboard');
              }, 500);
              return;
            }
          } catch (fallbackErr: any) {
            addDebugLog(`[AUTH CALLBACK] Fallback authentication error: ${fallbackErr.message}`);
            setError(`Authentication failed: ${fallbackErr.message}`);
            setLoading(false);
            return;
          }
          
          setError(`Exchange failed: ${exchangeError.message}`);
          setLoading(false);
          return;
        }

        if (data?.session) {
          addDebugLog('[AUTH CALLBACK] Session created successfully, redirecting to dashboard');
          addDebugLog(`[AUTH CALLBACK] Session details: ${JSON.stringify({
            userId: data.session.user.id,
            expiresAt: data.session.expires_at,
            accessToken: data.session.access_token ? 'present' : 'missing'
          })}`);
          
          // Small delay to ensure session is properly set
          setTimeout(() => {
            addDebugLog('[AUTH CALLBACK] Redirecting to dashboard...');
            router.push('/dashboard');
          }, 500);
        } else {
          addDebugLog('[AUTH CALLBACK] No session returned from exchange');
          addDebugLog(`[AUTH CALLBACK] Data received: ${JSON.stringify(data)}`);
          setError('Failed to create session - no session data returned');
          setLoading(false);
        }
      } catch (err: any) {
        addDebugLog(`[AUTH CALLBACK] Unexpected error: ${err.message}`);
        addDebugLog(`[AUTH CALLBACK] Error details: ${JSON.stringify({
          message: err.message,
          name: err.name,
          stack: err.stack
        })}`);
        
        // Handle timeout errors
        if (err.message?.includes('timeout')) {
          addDebugLog('[AUTH CALLBACK] Timeout error detected');
          setError('Authentication timed out. Please try signing in again.');
          setLoading(false);
          return;
        }
        
        setError(err.message || 'An unexpected error occurred during authentication');
        setLoading(false);
      }
    };

    addDebugLog('[AUTH CALLBACK] Starting callback handler...');
    handleCallback();

    // Cleanup timeout on unmount
    return () => {
      addDebugLog('[AUTH CALLBACK] Component unmounting, clearing timeout');
      clearTimeout(timeoutId);
    };
  }, [searchParams, router]);

  if (error) {
    addDebugLog(`[AUTH CALLBACK] Rendering error state: ${error}`);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  addDebugLog('[AUTH CALLBACK] Try Again button clicked');
                  router.push('/sign-in');
                }}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
          
          {/* Debug Logs Panel */}
          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Debug Logs:</h3>
            <div className="bg-gray-100 p-4 rounded-md max-h-96 overflow-y-auto">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                {debugLogs.join('\n')}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  addDebugLog('[AUTH CALLBACK] Rendering loading state');
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Signing you in…</p>
        <p className="text-xs text-gray-400 mt-4">This may take a few seconds...</p>
        
        {/* Debug Logs Panel */}
        <div className="mt-6 max-w-2xl mx-auto">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Debug Logs:</h3>
          <div className="bg-white p-4 rounded-md max-h-64 overflow-y-auto border">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap">
              {debugLogs.join('\n')}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
