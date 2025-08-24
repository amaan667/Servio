'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from '@/lib/supabaseClient';
import { useAuth } from '@/app/authenticated-client-provider';

export default function DebugAuthPage() {
  const [clientSession, setClientSession] = useState<any>(null);
  const [serverSession, setServerSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { session: authSession, loading: authLoading } = useAuth();

  useEffect(() => {
    const checkSessions = async () => {
      try {
        // Check client-side session
        if (supabase) {
          const { data: { session }, error } = await supabase.auth.getSession();
          setClientSession({ session, error: error?.message });
        }

        // Check server-side session via API
        try {
          const response = await fetch('/api/auth/debug-session');
          const serverData = await response.json();
          setServerSession(serverData);
        } catch (apiError) {
          setServerSession({ error: 'Failed to fetch server session' });
        }
      } catch (error) {
        console.error('Debug error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSessions();
  }, []);

  const configStatus = getSupabaseConfigStatus();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading debug information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Authentication Debug</h1>
        
        <div className="grid gap-6">
          {/* Configuration Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Configuration Status</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Supabase URL:</span>
                <span className={configStatus.url ? 'text-green-600' : 'text-red-600'}>
                  {configStatus.url ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Supabase Key:</span>
                <span className={configStatus.key ? 'text-green-600' : 'text-red-600'}>
                  {configStatus.key ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Client Initialized:</span>
                <span className={configStatus.client ? 'text-green-600' : 'text-red-600'}>
                  {configStatus.client ? '✅ Yes' : '❌ No'}
                </span>
              </div>
            </div>
          </div>

          {/* Auth Provider Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Auth Provider Status</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Loading:</span>
                <span className={authLoading ? 'text-yellow-600' : 'text-green-600'}>
                  {authLoading ? '⏳ Yes' : '✅ No'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Session:</span>
                <span className={authSession ? 'text-green-600' : 'text-red-600'}>
                  {authSession ? `✅ ${authSession.user?.email}` : '❌ None'}
                </span>
              </div>
            </div>
          </div>

          {/* Client Session */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Client Session</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(clientSession, null, 2)}
            </pre>
          </div>

          {/* Server Session */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Server Session</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(serverSession, null, 2)}
            </pre>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/clear-sessions'}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Clear All Sessions
              </button>
              <button
                onClick={() => window.location.href = '/sign-in'}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ml-2"
              >
                Go to Sign In
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ml-2"
              >
                Try Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}