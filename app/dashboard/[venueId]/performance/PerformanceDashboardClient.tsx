"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Clock, AlertCircle, TrendingUp } from "lucide-react";

interface PerformanceMetrics {
  apiResponseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  requestCount: number;
  endpointStats: Array<{
    endpoint: string;
    avgTime: number;
    count: number;
    errorRate: number;
  }>;
}

export function PerformanceDashboardClient({ venueId: _venueId }: { venueId: string }) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/performance");
        const data = await response.json();
        setMetrics(data);
      } catch (_error) {
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-6">Loading performance metrics...</div>;
  }

  if (!metrics) {
    return <div className="p-6">Failed to load metrics</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <p className="text-muted-foreground">Real-time API performance metrics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.apiResponseTime.p95}ms</div>
            <p className="text-xs text-muted-foreground">
              {metrics.apiResponseTime.p95 < 100
                ? "✅ Excellent"
                : metrics.apiResponseTime.p95 < 200
                  ? "⚠️ Good"
                  : "❌ Needs improvement"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.errorRate.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              {metrics.errorRate < 1 ? "✅ Healthy" : "⚠️ Elevated"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.requestCount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P99 Response Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.apiResponseTime.p99}ms</div>
            <p className="text-xs text-muted-foreground">Worst case</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints">Endpoint Performance</TabsTrigger>
          <TabsTrigger value="distribution">Response Distribution</TabsTrigger>
        </TabsList>
        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Statistics</CardTitle>
              <CardDescription>Performance by API endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.endpointStats.map((stat) => (
                  <div key={stat.endpoint} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{stat.endpoint}</p>
                      <p className="text-sm text-muted-foreground">{stat.count} requests</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{stat.avgTime}ms avg</p>
                      <p
                        className={`text-sm ${stat.errorRate > 1 ? "text-red-500" : "text-green-500"}`}
                      >
                        {stat.errorRate.toFixed(2)}% errors
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
