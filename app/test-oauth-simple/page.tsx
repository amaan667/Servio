'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { getAuthRedirectUrl } from '@/lib/auth';

export default function TestOAuthSimple() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback on page load
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      
      if (error) {
        setError(`OAuth error: ${error}`);
        return;
      }
      
      if (code) {
        console.log('[AUTH DEBUG] OAuth code received, exchanging for session');
        setLoading(true);
        
        try {
          // Exchange the code for a session using the client-side Supabase
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.log('[AUTH DEBUG] Exchange error:', exchangeError);
            setError(`Exchange error: ${exchangeError.message}`);
          } else if (data.session) {
            console.log('[AUTH DEBUG] Session created successfully');
            setResult({
              success: true,
              message: 'OAuth successful!',
              session: {
                userId: data.session.user?.id,
                userEmail: data.session.user?.email,
                hasRefreshToken: !!data.session.refresh_token
              }
            });
          } else {
            setError('No session created after code exchange');
          }
        } catch (err: any) {
          console.log('[AUTH DEBUG] Error during code exchange:', err);
          setError(`Error during code exchange: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }
    };

    handleOAuthCallback();
  }, []);

  const testOAuth = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('[AUTH DEBUG] Starting OAuth flow from client');
      
      // Clear any existing session first
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl('/auth/callback'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        console.log('[AUTH DEBUG] OAuth error:', error);
        setError(error.message);
      } else {
        console.log('[AUTH DEBUG] OAuth URL generated, redirecting');
        setResult({ message: 'Redirecting to OAuth...', url: data.url });
        // The redirect will happen automatically
      }
    } catch (err: any) {
      console.log('[AUTH DEBUG] Unexpected error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthState = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test-auth-state');
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkEnvironment = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/env-check');
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Clear client-side auth
      await supabase.auth.signOut();
      
      // Also clear server-side auth
      const response = await fetch('/api/clear-auth', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setResult({ message: 'Auth cleared successfully' });
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearUrlParams = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('code');
    currentUrl.searchParams.delete('error');
    window.history.replaceState({}, document.title, currentUrl.toString());
    console.log('URL params cleared.');
    setResult({ message: 'URL params cleared.' });
  };

  const checkOAuthStatus = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test-oauth-status');
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>OAuth Test & Debug</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={testOAuth} 
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'Testing...' : 'Test OAuth Flow'}
              </Button>
              
              <Button 
                onClick={checkOAuthStatus} 
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                Check OAuth Status
              </Button>
              
              <Button 
                onClick={checkAuthState} 
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                Check Auth State
              </Button>
              
              <Button 
                onClick={checkEnvironment} 
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                Check Environment
              </Button>
              
              <Button 
                onClick={clearUrlParams} 
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                Clear URL Params
              </Button>
              
              <Button 
                onClick={clearAuth} 
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                Clear Auth
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <div className="space-y-4">
                <h3 className="font-semibold">Result:</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
                
                {result.hasSession && (
                  <Alert>
                    <AlertDescription>
                      ✅ Session found! User is authenticated.
                    </AlertDescription>
                  </Alert>
                )}
                
                {result.hasUser && (
                  <div className="flex gap-2">
                    <Badge variant="secondary">User ID: {result.userId}</Badge>
                    <Badge variant="secondary">Email: {result.userEmail}</Badge>
                  </div>
                )}

                {result.session && (
                  <Alert>
                    <AlertDescription>
                      ✅ OAuth successful! User authenticated.
                    </AlertDescription>
                  </Alert>
                )}

                {result.oauth && (
                  <div className="space-y-2">
                    <h4 className="font-medium">OAuth Status:</h4>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <div>Status: <Badge variant="outline">{result.oauth.status}</Badge></div>
                      <div>Callback: {result.oauth.callback}</div>
                      <div>PKCE: {result.oauth.pkce}</div>
                    </div>
                  </div>
                )}

                {result.supabase && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Supabase Configuration:</h4>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <div>URL: {result.supabase.url}</div>
                      <div>Anon Key: {result.supabase.anonKey}</div>
                      <div>Service Role: {result.supabase.serviceRoleKey}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
