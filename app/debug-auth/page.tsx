'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

interface DebugInfo {
  timestamp: string;
  environment: {
    NODE_ENV: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  };
  auth: {
    hasUser: boolean;
    hasSession: boolean;
    userError: string | null;
    sessionError: string | null;
    userId: string | null;
    userEmail: string | null;
    sessionExpiry: string | null;
  };
  headers: {
    host: string | null;
    origin: string | null;
    referer: string | null;
    userAgent: string | null;
  };
}

export default function DebugAuthPage() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientAuthState, setClientAuthState] = useState<any>(null);

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        // Get server-side debug info
        const response = await fetch('/api/auth/debug');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setDebugInfo(data);
        
        // Get client-side auth state
            const { data: { session }, error: sessionError } = await supabaseBrowser().auth.getSession();
    const { data: { user }, error: userError } = await supabaseBrowser().auth.getUser();
        
        setClientAuthState({
          hasSession: !!session,
          hasUser: !!user,
          sessionError: sessionError?.message || null,
          userError: userError?.message || null,
          userId: user?.id || null,
          userEmail: user?.email || null,
          sessionExpiry: session?.expires_at || null,
        });
        
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDebugInfo();
  }, []);

  const clearAuthState = async () => {
    try {
              await supabaseBrowser().auth.signOut();
      window.location.reload();
    } catch (err: any) {
      console.error('Error clearing auth state:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading debug info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Authentication Debug</h1>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Server-Side Auth State</h2>
              {debugInfo && (
                <div className="bg-gray-50 rounded-md p-4">
                  <pre className="text-sm text-gray-700 overflow-auto">
                    {JSON.stringify(debugInfo.auth, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Client-Side Auth State</h2>
              {clientAuthState && (
                <div className="bg-gray-50 rounded-md p-4">
                  <pre className="text-sm text-gray-700 overflow-auto">
                    {JSON.stringify(clientAuthState, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Environment Variables</h2>
            {debugInfo && (
              <div className="bg-gray-50 rounded-md p-4">
                <pre className="text-sm text-gray-700 overflow-auto">
                  {JSON.stringify(debugInfo.environment, null, 2)}
                </pre>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex space-x-4">
            <button
              onClick={() => window.location.href = '/sign-in'}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Sign In
            </button>
            <button
              onClick={clearAuthState}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Clear Auth State
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
