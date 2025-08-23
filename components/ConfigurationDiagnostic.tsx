"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";

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
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
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
    if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
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
            name: 'Supabase Connection',
            status: 'ok',
            message: 'Connection successful',
            required: true
          });
        } else {
          status.push({
            name: 'Supabase Connection',
            status: 'error',
            message: 'Environment variables not accessible',
            required: true
          });
        }
      } else {
        status.push({
          name: 'API Connection',
          status: 'error',
          message: 'Cannot connect to API endpoints',
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
          <AlertCircle className="h-5 w-5" />
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
                    <li>Add your Supabase URL and anon key (see <code className="bg-red-100 px-1 rounded">.env.local.example</code>)</li>
                    <li>Restart the development server</li>
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