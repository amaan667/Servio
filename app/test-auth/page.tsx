'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestAuthPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testGoogleSignIn = async () => {
    setTestResult('Testing Google sign-in...');
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setTestResult(`Error: ${error.message}`);
      } else {
        setTestResult(`Success! Redirect URL: ${data.url}`);
        // Don't redirect automatically for testing
      }
    } catch (error) {
      setTestResult(`Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const signOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setSession(null);
      setTestResult('Signed out successfully');
    } catch (error) {
      setTestResult(`Sign out error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Authentication Test</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            {session ? (
              <div>
                <p><strong>User ID:</strong> {session.user.id}</p>
                <p><strong>Email:</strong> {session.user.email}</p>
                <p><strong>Expires:</strong> {new Date(session.expires_at * 1000).toLocaleString()}</p>
                <Button onClick={signOut} className="mt-2">Sign Out</Button>
              </div>
            ) : (
              <p>No active session</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Google Sign-In</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={testGoogleSignIn} disabled={!!session}>
              Test Google OAuth
            </Button>
            {testResult && (
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <p className="text-sm">{testResult}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Info</CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
            <p><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}</p>
            <p><strong>Supabase Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}</p>
            <p><strong>Site URL:</strong> {process.env.NEXT_PUBLIC_SITE_URL}</p>
            <p><strong>Current Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
