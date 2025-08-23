'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface DebugData {
  timestamp: string;
  environment: Record<string, any>;
  services: Record<string, any>;
  errors: string[];
  warnings: string[];
  summary: Record<string, any>;
  duration: string;
}

interface ErrorLog {
  timestamp: string;
  error: string;
  context?: Record<string, any>;
  environment?: Record<string, any>;
  url?: string;
  method?: string;
}

export default function DebugPage() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-all');
      const data = await response.json();
      setDebugData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch debug data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchErrorLogs = async () => {
    try {
      const response = await fetch('/api/error-logs?count=20');
      const data = await response.json();
      setErrorLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
    }
  };

  const clearErrorLogs = async () => {
    try {
      await fetch('/api/error-logs?clear=true');
      setErrorLogs([]);
    } catch (error) {
      console.error('Failed to clear error logs:', error);
    }
  };

  useEffect(() => {
    fetchDebugData();
    fetchErrorLogs();
  }, []);

  const getStatusIcon = (exists: boolean) => {
    return exists ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (exists: boolean) => {
    return exists ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        Present
      </Badge>
    ) : (
      <Badge variant="destructive">Missing</Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Debug Dashboard</h1>
          <p className="text-muted-foreground">
            Environment variables and service status
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchDebugData} 
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button onClick={clearErrorLogs} variant="destructive">
            Clear Logs
          </Button>
        </div>
      </div>

      {lastRefresh && (
        <p className="text-sm text-muted-foreground">
          Last updated: {lastRefresh.toLocaleString()}
        </p>
      )}

      <Tabs defaultValue="environment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="environment">Environment Variables</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="errors">Error Logs</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="environment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                Status of all environment variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debugData?.environment ? (
                <div className="grid gap-4">
                  {Object.entries(debugData.environment).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(value.exists)}
                        <div>
                          <p className="font-medium">{key}</p>
                          <p className="text-sm text-muted-foreground">
                            {value.value}
                            {value.length > 0 && ` (${value.length} chars)`}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(value.exists)}
                    </div>
                  ))}
                </div>
              ) : (
                <p>No environment data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Status</CardTitle>
              <CardDescription>
                Connection status of external services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debugData?.services ? (
                <div className="grid gap-4">
                  {Object.entries(debugData.services).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{service}</p>
                        <p className="text-sm text-muted-foreground">
                          {JSON.stringify(status)}
                        </p>
                      </div>
                      <Badge variant={status.status === 'connected' ? 'default' : 'destructive'}>
                        {status.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No service data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Logs</CardTitle>
              <CardDescription>
                Recent error logs and warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorLogs.length > 0 ? (
                <div className="space-y-4">
                  {errorLogs.map((log, index) => (
                    <Alert key={index}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <p className="font-medium">{log.error}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                          {log.url && (
                            <p className="text-sm text-muted-foreground">
                              URL: {log.url}
                            </p>
                          )}
                          {log.context && (
                            <details className="text-sm">
                              <summary>Context</summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                {JSON.stringify(log.context, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <p>No error logs available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
              <CardDescription>
                Overall system status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {debugData?.summary ? (
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Tests</p>
                      <p className="text-2xl font-bold">{debugData.summary.totalTests}</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Successful Tests</p>
                      <p className="text-2xl font-bold text-green-600">
                        {debugData.summary.successfulTests}
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Errors</p>
                      <p className="text-2xl font-bold text-red-600">
                        {debugData.summary.errorCount}
                      </p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Warnings</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {debugData.summary.warningCount}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="font-medium">Missing Variables:</p>
                    {debugData.summary.missingVariables?.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {debugData.summary.missingVariables.map((variable: string) => (
                          <Badge key={variable} variant="destructive">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-green-600">All required variables are present</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium">Environment:</p>
                    <Badge variant={debugData.summary.isProduction ? 'default' : 'secondary'}>
                      {debugData.summary.isProduction ? 'Production' : 'Development'}
                    </Badge>
                  </div>

                  {debugData.duration && (
                    <p className="text-sm text-muted-foreground">
                      Test duration: {debugData.duration}
                    </p>
                  )}
                </div>
              ) : (
                <p>No summary data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}