"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export default function DebugAuthPage() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const checkEnvironment = async () => {
    setLoading(true);
    
    const info: any = {
      timestamp: new Date().toISOString(),
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'undefined',
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      },
      browser: {
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
        localStorage: typeof window !== 'undefined' ? Object.keys(localStorage) : [],
        sessionStorage: typeof window !== 'undefined' ? Object.keys(sessionStorage) : [],
      }
    };

    // Check Supabase client
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      info.supabase = {
        configured: !!supabase,
        url: supabase?.supabaseUrl || 'not available',
      };
    } catch (error) {
      info.supabase = { error: (error as Error).message };
    }

    // Check auth session
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        info.session = {
          exists: !!session,
          user: session?.user?.email || 'none',
          expires: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none',
        };
      }
    } catch (error) {
      info.session = { error: (error as Error).message };
    }

    // Check API endpoints
    try {
      const res = await fetch('/api/env', { method: 'GET' });
      const apiData = await res.json();
      info.api = apiData;
    } catch (error) {
      info.api = { error: (error as Error).message };
    }

    setDebugInfo(info);
    setLoading(false);
  };

  const clearAllData = async () => {
    try {
      // Clear server session
      await fetch('/api/auth/clear-session', { method: 'POST' });
      
      // Clear browser storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // Reload page
      window.location.reload();
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  };

  useEffect(() => {
    checkEnvironment();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Auth Debug Panel</h1>
          <div className="flex gap-2">
            <Button onClick={checkEnvironment} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="destructive" onClick={clearAllData}>
              Clear All Data
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading debug information...
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Environment Variables */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Environment Variables
                  {debugInfo.environment?.NEXT_PUBLIC_SUPABASE_URL ? 
                    <CheckCircle className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                </CardTitle>
                <CardDescription>Current environment configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(debugInfo.environment || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <code className="text-sm font-mono">{key}</code>
                      <Badge variant={value ? "default" : "destructive"}>
                        {value ? 'Set' : 'Missing'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Supabase Client */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Supabase Client
                  {debugInfo.supabase?.configured ? 
                    <CheckCircle className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                </CardTitle>
                <CardDescription>Client configuration status</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                  {JSON.stringify(debugInfo.supabase, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Session Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Session Status
                  {debugInfo.session?.exists ? 
                    <CheckCircle className="h-5 w-5 text-green-500" /> : 
                    <XCircle className="h-5 w-5 text-red-500" />
                  }
                </CardTitle>
                <CardDescription>Current authentication session</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                  {JSON.stringify(debugInfo.session, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Browser Storage */}
            <Card>
              <CardHeader>
                <CardTitle>Browser Storage</CardTitle>
                <CardDescription>Local and session storage contents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Local Storage</h4>
                    <div className="space-y-1">
                      {debugInfo.browser?.localStorage?.map((key: string) => (
                        <div key={key} className="text-sm bg-gray-100 p-2 rounded">
                          {key}
                        </div>
                      ))}
                      {(!debugInfo.browser?.localStorage || debugInfo.browser.localStorage.length === 0) && (
                        <div className="text-sm text-gray-500">Empty</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Session Storage</h4>
                    <div className="space-y-1">
                      {debugInfo.browser?.sessionStorage?.map((key: string) => (
                        <div key={key} className="text-sm bg-gray-100 p-2 rounded">
                          {key}
                        </div>
                      ))}
                      {(!debugInfo.browser?.sessionStorage || debugInfo.browser.sessionStorage.length === 0) && (
                        <div className="text-sm text-gray-500">Empty</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* API Status */}
            <Card>
              <CardHeader>
                <CardTitle>API Status</CardTitle>
                <CardDescription>Backend API configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                  {JSON.stringify(debugInfo.api, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Troubleshooting */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Troubleshooting
                </CardTitle>
                <CardDescription>Common issues and solutions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!debugInfo.environment?.NEXT_PUBLIC_SUPABASE_URL && (
                    <Alert>
                      <AlertDescription>
                        <strong>Missing Supabase URL:</strong> The NEXT_PUBLIC_SUPABASE_URL environment variable is not set. 
                        This will cause authentication to fail.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {!debugInfo.environment?.NEXT_PUBLIC_SUPABASE_ANON_KEY && (
                    <Alert>
                      <AlertDescription>
                        <strong>Missing Supabase Key:</strong> The NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is not set. 
                        This will cause authentication to fail.
                      </AlertDescription>
                    </Alert>
                  )}

                  {debugInfo.browser?.localStorage?.some((key: string) => key.includes('placeholder')) && (
                    <Alert>
                      <AlertDescription>
                        <strong>Cached Placeholder Data:</strong> Found cached data with placeholder values. 
                        Click "Clear All Data" to remove cached information.
                      </AlertDescription>
                    </Alert>
                  )}

                  {debugInfo.session?.error && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <strong>Session Error:</strong> {debugInfo.session.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}