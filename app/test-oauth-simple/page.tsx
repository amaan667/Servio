'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function TestOAuthSimple() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testOAuth = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/test-oauth');
      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        // Redirect to the OAuth URL
        window.location.href = data.url;
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err: any) {
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
