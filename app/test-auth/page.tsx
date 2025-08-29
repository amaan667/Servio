'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/authenticated-client-provider';
import { createClient, getBrowserInfo, checkAuthState, clearAuthStorage } from '@/lib/sb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestAuthPage() {
  const { session, loading, signOut } = useAuth();
  const [browserInfo, setBrowserInfo] = useState<any>(null);
  const [authState, setAuthState] = useState<any>(null);
  const [testResults, setTestResults] = useState<any>(null);

  useEffect(() => {
    // Get browser info
    setBrowserInfo(getBrowserInfo());
    
    // Check auth state
    const checkAuth = async () => {
      const state = await checkAuthState();
      setAuthState(state);
    };
    checkAuth();
  }, []);

  const runAuthTests = async () => {
    const results = {
      timestamp: new Date().toISOString(),
      browserInfo: getBrowserInfo(),
      session: {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        expiresAt: session?.expires_at,
      },
      authState: await checkAuthState(),
      localStorage: {
        available: typeof window !== 'undefined' && !!window.localStorage,
        keys: typeof window !== 'undefined' ? Object.keys(localStorage).filter(k => k.startsWith('sb-')) : [],
      },
      sessionStorage: {
        available: typeof window !== 'undefined' && !!window.sessionStorage,
        keys: typeof window !== 'undefined' ? Object.keys(sessionStorage).filter(k => k.startsWith('sb-')) : [],
        signOutFlag: typeof window !== 'undefined' ? sessionStorage.getItem('auth_sign_out') : null,
      },
    };
    
    setTestResults(results);
    console.log('[AUTH TEST] Results:', results);
  };

  const handleSignOut = async () => {
    try {
      console.log('[AUTH TEST] Starting sign out process');
      await signOut();
      console.log('[AUTH TEST] Sign out completed');
      
      // Force clear storage
      clearAuthStorage();
      console.log('[AUTH TEST] Storage cleared');
      
      // Redirect to sign-in
      window.location.href = '/sign-in';
    } catch (error) {
      console.error('[AUTH TEST] Sign out error:', error);
    }
  };

  const forceClearStorage = () => {
    try {
      clearAuthStorage();
      console.log('[AUTH TEST] Force cleared storage');
      window.location.reload();
    } catch (error) {
      console.error('[AUTH TEST] Force clear error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Test - Universal Platform</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Browser Info</h3>
                <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
                  {JSON.stringify(browserInfo, null, 2)}
                </pre>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Current Session</h3>
                <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
                  {JSON.stringify({
                    hasSession: !!session,
                    userId: session?.user?.id,
                    userEmail: session?.user?.email,
                    expiresAt: session?.expires_at,
                  }, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Button onClick={runAuthTests} variant="outline">
                Run Auth Tests
              </Button>
              <Button onClick={handleSignOut} variant="destructive">
                Sign Out
              </Button>
              <Button onClick={forceClearStorage} variant="outline">
                Force Clear Storage
              </Button>
            </div>

            {testResults && (
              <div>
                <h3 className="font-semibold mb-2">Test Results</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}