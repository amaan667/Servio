'use client';

import { useState, useEffect } from 'react';
import { supabase, checkPKCEState, clearAuthStorage } from '@/lib/sb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AuthDebugPage() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    try {
      // Check current auth state
      const { data: sessionData, error: sessionError } = await createClient().auth.getSession();
      
      // Check PKCE state
      const pkceState = checkPKCEState();
      
      // Check localStorage and sessionStorage
      const localStorageKeys = Object.keys(localStorage);
      const sessionStorageKeys = Object.keys(sessionStorage);
      
      // Check for auth-related keys
      const authLocalKeys = localStorageKeys.filter(k => 
        k.startsWith('sb-') || k.includes('auth') || k.includes('pkce') || k.includes('verifier')
      );
      const authSessionKeys = sessionStorageKeys.filter(k => 
        k.startsWith('sb-') || k.includes('auth') || k.includes('pkce') || k.includes('verifier')
      );

      setDebugInfo({
        timestamp: new Date().toISOString(),
        session: {
          hasSession: !!sessionData.session,
          hasUser: !!sessionData.session?.user,
          userId: sessionData.session?.user?.id,
          userEmail: sessionData.session?.user?.email,
          error: sessionError?.message
        },
        pkceState,
        storage: {
          localStorageKeys: authLocalKeys,
          sessionStorageKeys: authSessionKeys,
          totalLocalKeys: localStorageKeys.length,
          totalSessionKeys: sessionStorageKeys.length
        },
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    } catch (error: any) {
      setDebugInfo({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const clearAllStorage = () => {
    clearAuthStorage();
    localStorage.clear();
    sessionStorage.clear();
    alert('All storage cleared. Please refresh the page.');
  };

  useEffect(() => {
    runDebug();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Authentication Debug</h1>
          <p className="text-gray-600">Debug information for authentication issues</p>
        </div>

        <div className="space-y-4 mb-6">
          <Button onClick={runDebug} disabled={loading}>
            {loading ? 'Running Debug...' : 'Refresh Debug Info'}
          </Button>
          <Button onClick={clearAllStorage} variant="destructive">
            Clear All Storage
          </Button>
        </div>

        {debugInfo && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Session Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugInfo.session, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PKCE State</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugInfo.pkceState, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Storage Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(debugInfo.storage, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Environment Information</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify({
                    url: debugInfo.url,
                    userAgent: debugInfo.userAgent,
                    timestamp: debugInfo.timestamp
                  }, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {debugInfo.error && (
              <Alert variant="destructive">
                <AlertDescription>
                  <pre className="text-sm">{debugInfo.error}</pre>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    </div>
  );
}