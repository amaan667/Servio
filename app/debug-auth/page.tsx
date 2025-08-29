'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/authenticated-client-provider';
import { createClient } from '@/lib/supabase/client';

export default function DebugAuthPage() {
  const { session, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [serverDebugInfo, setServerDebugInfo] = useState<any>(null);
  const [pkceState, setPkceState] = useState<any>(null);

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        // Get client-side auth state
        const { data, error } = await createClient().auth.getSession();
        setDebugInfo({ data, error, timestamp: new Date().toISOString() });
        
        // Get server-side auth state
        const response = await fetch('/api/debug-auth');
        const serverData = await response.json();
        setServerDebugInfo(serverData);
        
        // Get PKCE state
        const { checkPKCEState } = await import('@/lib/supabase/client');
        const pkceData = checkPKCEState();
        setPkceState(pkceData);
      } catch (error) {
        console.error('[AUTH DEBUG] Error fetching debug info:', error);
      }
    };

    fetchDebugInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Debug</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Client-side Auth State */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Client-side Auth State</h2>
            <div className="space-y-4">
              <div>
                <strong>Provider Loading:</strong> {loading ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Session Exists:</strong> {session ? 'Yes' : 'No'}
              </div>
              {session && (
                <>
                  <div>
                    <strong>User ID:</strong> {session.user.id}
                  </div>
                  <div>
                    <strong>User Email:</strong> {session.user.email}
                  </div>
                  <div>
                    <strong>Session Expires:</strong> {new Date(session.expires_at! * 1000).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Server-side Auth State */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Server-side Auth State</h2>
            {serverDebugInfo ? (
              <div className="space-y-4">
                <div>
                  <strong>Session Exists:</strong> {serverDebugInfo.session.exists ? 'Yes' : 'No'}
                </div>
                {serverDebugInfo.session.exists && (
                  <>
                    <div>
                      <strong>User ID:</strong> {serverDebugInfo.session.userId}
                    </div>
                    <div>
                      <strong>User Email:</strong> {serverDebugInfo.session.userEmail}
                    </div>
                  </>
                )}
                <div>
                  <strong>Environment:</strong>
                  <pre className="text-xs mt-2 bg-gray-100 p-2 rounded">
                    {JSON.stringify(serverDebugInfo.environment, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div>Loading...</div>
            )}
          </div>

          {/* PKCE State */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">PKCE State</h2>
            {pkceState ? (
              <div className="space-y-4">
                <div>
                  <strong>OAuth In Progress:</strong> {pkceState.oauthInProgress ? 'Yes' : 'No'}
                </div>
                <div>
                  <strong>Local Storage Keys:</strong> {pkceState.localStorage.authKeys.length}
                </div>
                <div>
                  <strong>Session Storage Keys:</strong> {pkceState.sessionStorage.authKeys.length}
                </div>
                <div>
                  <strong>PKCE Keys:</strong>
                  <pre className="text-xs mt-2 bg-gray-100 p-2 rounded">
                    {JSON.stringify(pkceState.pkceKeys, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div>Loading...</div>
            )}
          </div>

          {/* Raw Debug Info */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Raw Debug Info</h2>
            {debugInfo ? (
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-64">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            ) : (
              <div>Loading...</div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-x-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            <button
              onClick={() => window.location.href = '/sign-in'}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Go to Sign In
            </button>
            <button
              onClick={() => window.location.href = '/api/debug-auth'}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              View Debug API
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
