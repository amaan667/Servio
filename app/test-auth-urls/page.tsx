'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { testOAuthRedirects } from '@/lib/supabase';

export default function TestAuthUrlsPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    try {
      // Test 1: OAuth redirect configuration
      const oauthTest = testOAuthRedirects();
      
      // Test 2: Environment variables
      const envTest = {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      };

      // Test 3: Client-side URL detection
      const clientTest = {
        windowLocation: typeof window !== 'undefined' ? window.location.href : 'server-side',
        windowOrigin: typeof window !== 'undefined' ? window.location.origin : 'server-side',
        hasLocalhost: typeof window !== 'undefined' ? window.location.origin.includes('localhost') : false,
      };

      // Test 4: Expected redirect URL
      const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app';
      const expectedRedirectUrl = `${envUrl.replace(/\/+$/, '')}/auth/callback`;
      
      const redirectTest = {
        envUrl,
        expectedRedirectUrl,
        hasLocalhost: expectedRedirectUrl.includes('localhost') || expectedRedirectUrl.includes('127.0.0.1'),
      };

      setTestResults({
        oauthTest,
        envTest,
        clientTest,
        redirectTest,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      setTestResults({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const getStatusColor = (passed: boolean) => passed ? 'text-green-600' : 'text-red-600';
  const getStatusIcon = (passed: boolean) => passed ? '✅' : '❌';

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Auth URL Configuration Test</CardTitle>
            <CardDescription>
              Testing that OAuth redirects never use localhost and work correctly in production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runTests} disabled={loading} className="mb-4">
              {loading ? 'Running Tests...' : 'Run Tests'}
            </Button>

            {testResults && (
              <div className="space-y-4">
                {/* OAuth Test Results */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">OAuth Redirect Configuration</h3>
                  <p className={getStatusColor(testResults.oauthTest)}>
                    {getStatusIcon(testResults.oauthTest)} {testResults.oauthTest ? 'PASSED' : 'FAILED'}
                  </p>
                </div>

                {/* Environment Variables */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Environment Variables</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(testResults.envTest).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-mono">{key}:</span>
                        <span className={value === 'Missing' ? 'text-red-600' : 'text-green-600'}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Client-side Detection */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Client-side URL Detection</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(testResults.clientTest).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-mono">{key}:</span>
                        <span className={key === 'hasLocalhost' && value ? 'text-red-600' : 'text-gray-600'}>
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Redirect URL Test */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Expected Redirect URL</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(testResults.redirectTest).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="font-mono">{key}:</span>
                        <span className={key === 'hasLocalhost' && value ? 'text-red-600' : 'text-gray-600'}>
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error Display */}
                {testResults.error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <strong>Test Error:</strong> {testResults.error}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Summary */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-2">Test Summary</h3>
                  <div className="text-sm space-y-1">
                    <p><strong>Timestamp:</strong> {testResults.timestamp}</p>
                    <p><strong>OAuth Test:</strong> {testResults.oauthTest ? 'PASSED' : 'FAILED'}</p>
                    <p><strong>Environment:</strong> {testResults.envTest.NEXT_PUBLIC_SUPABASE_URL === 'Set' ? 'CONFIGURED' : 'MISSING'}</p>
                    <p><strong>Redirect URL:</strong> {testResults.redirectTest?.hasLocalhost ? 'CONTAINS LOCALHOST' : 'SAFE'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
