'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SignInButton from './sign-in-button';
import { clearCrossPlatformAuthState, checkCrossPlatformPKCEState, testCrossPlatformOAuthFlow } from '@/lib/auth/mobile-auth-utils';

export default function SignInForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const router = useRouter();

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Clear any existing authentication state first
      clearCrossPlatformAuthState();
      
      // Check initial PKCE state
      const initialState = checkCrossPlatformPKCEState();
      console.log('[SIGN-IN] Initial PKCE state:', initialState);
      
      // Import and call signInWithGoogle
      const { signInWithGoogle } = await import('@/lib/auth/signin');
      await signInWithGoogle();
    } catch (err: any) {
      console.error('[SIGN-IN] Error during sign-in:', err);
      setError(err.message || 'Sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDebugAuth = async () => {
    try {
      const debugResult = await testCrossPlatformOAuthFlow();
      setDebugInfo(debugResult);
      console.log('[DEBUG] Cross-platform OAuth test result:', debugResult);
    } catch (err) {
      console.error('[DEBUG] Error during debug test:', err);
      setError('Debug test failed');
    }
  };

  const handleClearAuth = () => {
    try {
      const clearResult = clearCrossPlatformAuthState();
      setDebugInfo(clearResult);
      console.log('[DEBUG] Auth state cleared:', clearResult);
    } catch (err) {
      console.error('[DEBUG] Error clearing auth state:', err);
      setError('Failed to clear auth state');
    }
  };

  const handleCheckPKCE = () => {
    try {
      const pkceState = checkCrossPlatformPKCEState();
      setDebugInfo(pkceState);
      console.log('[DEBUG] PKCE state check:', pkceState);
    } catch (err) {
      console.error('[DEBUG] Error checking PKCE state:', err);
      setError('Failed to check PKCE state');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Sign In</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <div className="space-y-4">
        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>
        
        {/* Debug tools for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 p-4 bg-gray-100 rounded">
            <h3 className="text-lg font-semibold mb-3">Debug Tools</h3>
            <div className="space-y-2">
              <button
                onClick={handleDebugAuth}
                className="w-full px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Test Cross-Platform OAuth
              </button>
              <button
                onClick={handleCheckPKCE}
                className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Check PKCE State
              </button>
              <button
                onClick={handleClearAuth}
                className="w-full px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Clear Auth State
              </button>
            </div>
          </div>
        )}
        
        {debugInfo && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <h4 className="font-semibold mb-2">Debug Info:</h4>
            <pre className="text-xs overflow-auto max-h-40">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
