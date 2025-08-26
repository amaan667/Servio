"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearAuthStorage, checkAuthState } from "@/lib/sb-client";
import { supabase } from "@/lib/sb-client";

export default function AuthDebugPage() {
  const [authState, setAuthState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [apiTest, setApiTest] = useState<any>(null);

  const checkState = async () => {
    setLoading(true);
    try {
      const state = await checkAuthState();
      setAuthState(state);
      
      // Get storage information
      const storage = {
        localStorage: Object.keys(localStorage).filter(k => 
          k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
        ),
        sessionStorage: Object.keys(sessionStorage).filter(k => 
          k.startsWith("sb-") || k.includes("pkce") || k.includes("verifier") || k.includes("auth")
        )
      };
      setStorageInfo(storage);
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearStorage = () => {
    clearAuthStorage();
    checkState();
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      await checkState();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  };

  const testApi = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-auth');
      const data = await response.json();
      setApiTest(data);
    } catch (error) {
      console.error('Error testing API:', error);
      setApiTest({ error: 'Failed to test API' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkState();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Authentication Debug</h1>
          <p className="mt-2 text-gray-600">Debug authentication state and storage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
              <CardDescription>Authentication management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={checkState} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Checking...' : 'Check Auth State'}
              </Button>
              
              <Button 
                onClick={clearStorage} 
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Clear Auth Storage
              </Button>
              
              <Button 
                onClick={signOut} 
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                Sign Out
              </Button>
              
              <Button 
                onClick={testApi} 
                disabled={loading}
                variant="secondary"
                className="w-full"
              >
                Test API
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auth State</CardTitle>
              <CardDescription>Current authentication status</CardDescription>
            </CardHeader>
            <CardContent>
              {authState ? (
                <div className="space-y-2 text-sm">
                  <div><strong>Has Session:</strong> {authState.data?.session ? 'Yes' : 'No'}</div>
                  <div><strong>Has User:</strong> {authState.data?.session?.user ? 'Yes' : 'No'}</div>
                  {authState.data?.session?.user && (
                    <>
                      <div><strong>User ID:</strong> {authState.data.session.user.id}</div>
                      <div><strong>Email:</strong> {authState.data.session.user.email}</div>
                      <div><strong>Expires At:</strong> {new Date(authState.data.session.expires_at * 1000).toLocaleString()}</div>
                    </>
                  )}
                  {authState.error && (
                    <div className="text-red-600"><strong>Error:</strong> {authState.error.message}</div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">No auth state available</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Storage Information</CardTitle>
            <CardDescription>Authentication-related storage keys</CardDescription>
          </CardHeader>
          <CardContent>
            {storageInfo ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">localStorage Keys:</h4>
                  {storageInfo.localStorage.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {storageInfo.localStorage.map((key: string) => (
                        <li key={key} className="bg-gray-100 p-2 rounded">
                          {key}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No auth-related localStorage keys</p>
                  )}
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">sessionStorage Keys:</h4>
                  {storageInfo.sessionStorage.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {storageInfo.sessionStorage.map((key: string) => (
                        <li key={key} className="bg-gray-100 p-2 rounded">
                          {key}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No auth-related sessionStorage keys</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No storage information available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Configuration and environment variables</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not Set'}</div>
              <div><strong>Supabase Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not Set'}</div>
              <div><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'Server-side'}</div>
              <div><strong>User Agent:</strong> {typeof window !== 'undefined' ? navigator.userAgent.substring(0, 100) + '...' : 'Server-side'}</div>
            </div>
          </CardContent>
        </Card>

        {apiTest && (
          <Card>
            <CardHeader>
              <CardTitle>API Test Results</CardTitle>
              <CardDescription>Authentication API connectivity test</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Success:</strong> {apiTest.success ? 'Yes' : 'No'}</div>
                {apiTest.error && <div className="text-red-600"><strong>Error:</strong> {apiTest.error}</div>}
                {apiTest.message && <div><strong>Message:</strong> {apiTest.message}</div>}
                {apiTest.config && (
                  <div>
                    <strong>Config:</strong>
                    <ul className="ml-4">
                      <li>URL: {apiTest.config.hasUrl ? 'Set' : 'Not Set'}</li>
                      <li>Key: {apiTest.config.hasKey ? 'Set' : 'Not Set'}</li>
                      <li>URL Prefix: {apiTest.config.urlPrefix}</li>
                    </ul>
                  </div>
                )}
                <div><strong>Timestamp:</strong> {apiTest.timestamp}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}