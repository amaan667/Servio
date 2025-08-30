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
      console.log('[AUTH DEBUG] === OAUTH CALLBACK START ===');
      console.log('[AUTH DEBUG] Step 1: Extracting callback parameters');
      
      const code = searchParams.get('code');
      const error = searchParams.get('error');
      const state = searchParams.get('state');
      
      console.log('[AUTH DEBUG] Callback parameters:', { 
        hasCode: !!code, 
        codeLength: code?.length,
        error,
        hasState: !!state,
        currentUrl: window.location.href,
        searchParams: Object.fromEntries(searchParams.entries())
      });
      
      if (error) {
        console.log('[AUTH DEBUG] OAuth error in callback:', error);
        setError(`OAuth error: ${error}`);
        setStatus('error');
        return;
      }
      
      if (!code) {
        console.log('[AUTH DEBUG] No authorization code received');
        setError('No authorization code received');
        setStatus('error');
        return;
      }
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.log('[AUTH DEBUG] Callback timeout reached (30 seconds)');
        setError('Authentication timed out. Please try again.');
        setStatus('error');
      }, 30000); // 30 seconds timeout
      
      try {
        console.log('[AUTH DEBUG] Step 2: Testing Supabase connection');
        console.log('[AUTH DEBUG] Code length:', code?.length);
        console.log('[AUTH DEBUG] Supabase client config:', {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        });
        
        // Test Supabase connection first
        console.log('[AUTH DEBUG] Testing Supabase connection...');
        const { data: testData, error: testError } = await supabase.auth.getSession();
        console.log('[AUTH DEBUG] Connection test result:', { 
          hasTestData: !!testData, 
          hasTestError: !!testError,
          testErrorMessage: testError?.message 
        });
        
        console.log('[AUTH DEBUG] Step 3: Exchanging code for session');
        // Exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        console.log('[AUTH DEBUG] Step 4: Exchange result analysis');
        console.log('[AUTH DEBUG] Exchange result:', { 
          hasData: !!data, 
          hasSession: !!data?.session, 
          hasUser: !!data?.session?.user,
          userId: data?.session?.user?.id,
          hasError: !!exchangeError,
          errorMessage: exchangeError?.message,
          errorCode: exchangeError?.status
        });
        
        if (exchangeError) {
          console.log('[AUTH DEBUG] Exchange error details:', {
            message: exchangeError.message,
            status: exchangeError.status,
            name: exchangeError.name,
            stack: exchangeError.stack
          });
          setError(`Authentication failed: ${exchangeError.message}`);
          setStatus('error');
          return;
        }
        
        if (!data.session) {
          console.log('[AUTH DEBUG] No session created after exchange');
          console.log('[AUTH DEBUG] Full exchange data:', data);
          setError('Authentication failed: No session created');
          setStatus('error');
          return;
        }
        
        console.log('[AUTH DEBUG] Step 5: Session verification');
        console.log('[AUTH DEBUG] Session details:', {
          userId: data.session.user.id,
          userEmail: data.session.user.email,
          accessToken: data.session.access_token ? 'Present' : 'Missing',
          refreshToken: data.session.refresh_token ? 'Present' : 'Missing',
          expiresAt: data.session.expires_at
        });
        
        // Verify session is properly set
        console.log('[AUTH DEBUG] Step 6: Verifying session persistence');
        const { data: verifyData, error: verifyError } = await supabase.auth.getSession();
        console.log('[AUTH DEBUG] Session verification:', {
          hasSession: !!verifyData.session,
          hasUser: !!verifyData.session?.user,
          userId: verifyData.session?.user?.id,
          hasError: !!verifyError,
          errorMessage: verifyError?.message
        });
        
        console.log('[AUTH DEBUG] Step 7: Authentication successful, preparing redirect');
        clearTimeout(timeoutId);
        setStatus('success');
        
        // Redirect to home page after successful authentication
        // The navigation will show "Dashboard" button for signed-in users
        setTimeout(() => {
          console.log('[AUTH DEBUG] Step 8: Redirecting to home page');
          console.log('[AUTH DEBUG] === OAUTH CALLBACK SUCCESS ===');
          router.replace('/');
        }, 1000);
        
      } catch (err: any) {
        console.log('[AUTH DEBUG] Step X: Unexpected error during callback');
        console.log('[AUTH DEBUG] Error details:', {
          message: err.message,
          name: err.name,
          stack: err.stack,
          type: typeof err
        });
        clearTimeout(timeoutId);
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
          <p className="text-xs text-gray-400 mt-2">Please wait while we verify your account</p>
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
