'use client';
export const dynamic = "force-dynamic";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/sb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TestResults {
  environment?: any;
  client?: any;
  connection?: any;
  api?: any;
  url?: any;
  googleSignIn?: {
    success: boolean;
    url?: string;
    error?: string;
    timestamp: string;
  };
  timestamp: string;
}

export default function AuthDebugPage() {
  const router = useRouter();
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [supabaseClient, setSupabaseClient] = useState<any>(null);

  // Initialize Supabase client only on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupabaseClient(createClient());
    }
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runTests = async () => {
    if (!supabaseClient) {
      addLog('Supabase client not initialized yet');
      return;
    }

    setLoading(true);
    setLogs([]);
    addLog('Starting authentication debug tests...');

    try {
      // Test 1: Environment variables
      addLog('Testing environment variables...');
      const envTest = {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET',
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      };
      addLog(`Environment test: ${JSON.stringify(envTest, null, 2)}`);

      // Test 2: Supabase client
      addLog('Testing Supabase client...');
      const clientTest = {
        clientExists: !!supabaseClient,
        authExists: !!(supabaseClient && supabaseClient.auth),
        signInWithOAuthExists: !!(supabaseClient && supabaseClient.auth && supabaseClient.auth.signInWithOAuth),
        exchangeCodeForSessionExists: !!(supabaseClient && supabaseClient.auth && supabaseClient.auth.exchangeCodeForSession),
      };
      addLog(`Client test: ${JSON.stringify(clientTest, null, 2)}`);

      // Test 3: Basic connection
      addLog('Testing basic Supabase connection...');
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
      const connectionTest = {
        success: !sessionError,
        error: sessionError?.message,
        hasSession: !!sessionData?.session,
      };
      addLog(`Connection test: ${JSON.stringify(connectionTest, null, 2)}`);

      // Test 4: API endpoint test
      addLog('Testing API endpoint...');
      const apiResponse = await fetch('/api/test-supabase');
      const apiTest = await apiResponse.json();
      addLog(`API test: ${JSON.stringify(apiTest, null, 2)}`);

      // Test 5: Current URL analysis
      addLog('Analyzing current URL...');
      const urlTest = {
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      };
      addLog(`URL test: ${JSON.stringify(urlTest, null, 2)}`);

      setTestResults({
        environment: envTest,
        client: clientTest,
        connection: connectionTest,
        api: apiTest,
        url: urlTest,
        timestamp: new Date().toISOString(),
      });

      addLog('All tests completed successfully!');
    } catch (error) {
      addLog(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Debug test error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testGoogleSignIn = async () => {
    if (!supabaseClient) {
      addLog('Supabase client not initialized yet');
      return;
    }

    setLoading(true);
    addLog('Testing Google sign-in flow...');

    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) {
        addLog(`Google sign-in error: ${error.message}`);
        throw error;
      }
      
      addLog('Google sign-in initiated successfully');
      addLog(`Redirect URL: ${data.url}`);
      
      // Don't redirect automatically, let user see the result
      setTestResults((prev: TestResults | null) => ({
        ...prev!,
        googleSignIn: {
          success: true,
          url: data.url,
          timestamp: new Date().toISOString(),
        }
      }));
    } catch (error) {
      addLog(`Google sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTestResults((prev: TestResults | null) => ({
        ...prev!,
        googleSignIn: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setTestResults(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Authentication Debug</h1>
          <Button onClick={() => router.push('/sign-in')} variant="outline">
            Back to Sign In
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Debug Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runTests} disabled={loading || !supabaseClient}>
                {loading ? 'Running Tests...' : 'Run All Tests'}
              </Button>
              <Button onClick={testGoogleSignIn} disabled={loading || !supabaseClient} variant="outline">
                Test Google Sign-In
              </Button>
              <Button onClick={clearLogs} variant="outline">
                Clear Logs
              </Button>
            </div>
          </CardContent>
        </Card>

        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Debug Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}