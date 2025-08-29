'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/authenticated-client-provider';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestAuthState() {
  const { session, loading } = useAuth();
  const [localSession, setLocalSession] = useState<any>(null);
  const [localLoading, setLocalLoading] = useState(true);

  useEffect(() => {
    const checkLocalSession = async () => {
      try {
        const { data, error } = await createClient().auth.getSession();
        console.log('[TEST] Local session check:', { data, error });
        setLocalSession(data.session);
      } catch (err) {
        console.error('[TEST] Error checking local session:', err);
      } finally {
        setLocalLoading(false);
      }
    };

    checkLocalSession();
  }, []);

  const clearAllAuth = async () => {
    try {
      // Clear all Supabase storage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")) {
          localStorage.removeItem(k);
        }
      });
      
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")) {
          sessionStorage.removeItem(k);
        }
      });

      // Sign out from Supabase
      await createClient().auth.signOut();
      
      // Call API signout
      await fetch('/api/auth/signout', { method: 'POST' });
      
      window.location.reload();
    } catch (err) {
      console.error('[TEST] Error clearing auth:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication State Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Auth Provider State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
                <p><strong>Has Session:</strong> {session ? 'Yes' : 'No'}</p>
                {session && (
                  <>
                    <p><strong>User ID:</strong> {session.user?.id}</p>
                    <p><strong>Email:</strong> {session.user?.email}</p>
                    <p><strong>Has Access Token:</strong> {session.access_token ? 'Yes' : 'No'}</p>
                    <p><strong>Expires At:</strong> {session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A'}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Local Supabase State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Loading:</strong> {localLoading ? 'Yes' : 'No'}</p>
                <p><strong>Has Session:</strong> {localSession ? 'Yes' : 'No'}</p>
                {localSession && (
                  <>
                    <p><strong>User ID:</strong> {localSession.user?.id}</p>
                    <p><strong>Email:</strong> {localSession.user?.email}</p>
                    <p><strong>Has Access Token:</strong> {localSession.access_token ? 'Yes' : 'No'}</p>
                    <p><strong>Expires At:</strong> {localSession.expires_at ? new Date(localSession.expires_at * 1000).toLocaleString() : 'N/A'}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={clearAllAuth} variant="destructive">
                Clear All Authentication
              </Button>
              
              <Button onClick={() => window.location.href = '/sign-in'}>
                Go to Sign In
              </Button>
              
              <Button onClick={() => window.location.href = '/'}>
                Go to Home
              </Button>
              
              <Button onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Storage Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">LocalStorage Keys:</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {Object.keys(localStorage)
                    .filter(k => k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth"))
                    .join('\n')}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">SessionStorage Keys:</h4>
                <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                  {Object.keys(sessionStorage)
                    .filter(k => k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth"))
                    .join('\n')}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}