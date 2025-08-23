"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Info } from "lucide-react";

interface ConfigStatus {
  name: string;
  status: 'ok' | 'missing' | 'error';
  message: string;
  required: boolean;
}

export default function ConfigurationDiagnostic() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const checkConfiguration = async () => {
    setLoading(true);
    const status: ConfigStatus[] = [];

    // Check Supabase URL
    const hasUrl = typeof window !== 'undefined' ? 
      !!window.__NEXT_DATA__?.props?.pageProps?.supabaseUrl || 
      !!process.env.NEXT_PUBLIC_SUPABASE_URL : 
      !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (hasUrl) {
      status.push({
        name: 'Supabase URL',
        status: 'ok',
        message: 'Configured',
        required: true
      });
    } else {
      status.push({
        name: 'Supabase URL',
        status: 'missing',
        message: 'NEXT_PUBLIC_SUPABASE_URL is not set',
        required: true
      });
    }

    // Check Supabase Anon Key
    const hasKey = typeof window !== 'undefined' ? 
      !!window.__NEXT_DATA__?.props?.pageProps?.supabaseKey || 
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : 
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (hasKey) {
      status.push({
        name: 'Supabase Anon Key',
        status: 'ok',
        message: 'Configured',
        required: true
      });
    } else {
      status.push({
        name: 'Supabase Anon Key',
        status: 'missing',
        message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set',
        required: true
      });
    }

    // Test Supabase connection
    try {
      const response = await fetch('/api/env-debug');
      if (response.ok) {
        const data = await response.json();
        if (data.NEXT_PUBLIC_SUPABASE_URL) {
          status.push({
            name: 'API Connection',
            status: 'ok',
            message: 'Connection successful',
            required: true
          });
        } else {
          status.push({
            name: 'API Connection',
            status: 'error',
            message: 'Environment variables not accessible via API',
            required: true
          });
        }
      } else {
        status.push({
          name: 'API Connection',
          status: 'error',
          message: `HTTP ${response.status}: Cannot connect to API endpoints`,
          required: true
        });
      }
    } catch (error) {
      status.push({
        name: 'API Connection',
        status: 'error',
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        required: true
      });
    }

    // Test network connectivity
    try {
      const networkResponse = await fetch('/api/env-debug', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      if (networkResponse.ok) {
        status.push({
          name: 'Network Connectivity',
          status: 'ok',
          message: 'Network connection working',
          required: true
        });
      } else {
        status.push({
          name: 'Network Connectivity',
          status: 'error',
          message: 'Network connection issues detected',
          required: true
        });
      }
    } catch (error) {
      status.push({
        name: 'Network Connectivity',
        status: 'error',
        message: 'No network connection available',
        required: true
      });
    }

    setConfigStatus(status);
    setLoading(false);
  };

  useEffect(() => {
    checkConfiguration();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'missing':
        return 'bg-red-100 text-red-800';
      case 'error':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const hasCriticalIssues = configStatus.some(item => item.required && item.status !== 'ok');

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Info className="h-5 w-5" />
          <span>Configuration Diagnostic</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {configStatus.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(item.status)}
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.message}</div>
                  </div>
                </div>
                <Badge className={getStatusColor(item.status)}>
                  {item.status.toUpperCase()}
                </Badge>
              </div>
            ))}

            {hasCriticalIssues && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="font-medium text-red-800 mb-2">Configuration Issues Found</h3>
                <p className="text-sm text-red-600 mb-3">
                  The live orders page requires proper Supabase configuration to function.
                </p>
                <div className="text-sm text-red-600 space-y-1">
                  <p>To fix this:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-4">
                    <li>Create a <code className="bg-red-100 px-1 rounded">.env.local</code> file in the project root</li>
                    <li>Add your Supabase URL and anon key:
                      <pre className="bg-red-100 p-2 rounded mt-1 text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key`}
                      </pre>
                    </li>
                    <li>Restart the development server</li>
                    <li>Check that you're logged in to the application</li>
                  </ol>
                </div>
              </div>
            )}

            <div className="flex justify-center mt-6">
              <Button onClick={checkConfiguration} className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>Refresh Diagnostic</span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}