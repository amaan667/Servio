"use client";

import { useState } from 'react';
import { signInWithGoogle } from '@/lib/auth/signin';
import { checkPKCEState } from '@/lib/supabase/client';

export default function TestPKCEFix() {
  const [pkceState, setPkceState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkState = async () => {
    try {
      const state = checkPKCEState();
      setPkceState(state);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const testSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const clearStorage = () => {
    try {
      // Clear all PKCE-related storage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.includes("pkce") || k.includes("token-code-verifier")) {
          localStorage.removeItem(k);
        }
      });
      Object.keys(sessionStorage).forEach((k) => {
        if (k.includes("pkce") || k.includes("verifier")) {
          sessionStorage.removeItem(k);
        }
      });
      setPkceState(null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">PKCE Fix Test Page</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">PKCE Flow Test</h2>
          
          <div className="space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={checkState}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Check PKCE State
              </button>
              
              <button
                onClick={testSignIn}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Starting OAuth...' : 'Test OAuth Sign In'}
              </button>
              
              <button
                onClick={clearStorage}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Clear Storage
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="text-red-800 font-medium">Error:</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            )}

            {pkceState && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h3 className="text-gray-800 font-medium mb-2">PKCE State:</h3>
                <pre className="text-sm text-gray-700 overflow-auto">
                  {JSON.stringify(pkceState, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Fix Summary</h2>
          
          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-medium text-gray-900">✅ Variable Initialization Fixed:</h3>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Declared <code>authCode</code> and <code>codeVerifier</code> as variables before use</li>
                <li>Properly assigned values when authentication code is received</li>
                <li>Added validation to ensure both variables have valid string values</li>
                <li>Only call PKCE exchange after both variables are ready</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">✅ Async Flow Improvements:</h3>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Step-by-step variable assignment with proper validation</li>
                <li>Enhanced error handling for uninitialized variables</li>
                <li>Better logging to track variable state throughout the flow</li>
                <li>Prevents premature PKCE exchange calls</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">✅ Enhanced Validation:</h3>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Check for null/undefined values before use</li>
                <li>Validate string lengths and types</li>
                <li>Comprehensive error logging for debugging</li>
                <li>Graceful error handling with user-friendly messages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}