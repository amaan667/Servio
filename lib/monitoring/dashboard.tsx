"use client";

/**
 * Performance Monitoring Dashboard
 * Real-time monitoring of API performance, errors, and system health
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PerformanceData {
  apiRequests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  };
  errors: {
    count: number;
    recent: Array<{ message: string; timestamp: string }>;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    activeConnections: number;
  };
}

export function PerformanceDashboard() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch("/api/performance");
        const metrics = await response.json();
        setData(metrics.data);
      } catch (error) {
        /* Error handled silently */
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-gray-500">No metrics available</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>API Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Requests</span>
              <Badge>{data.apiRequests.total}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600">{data.apiRequests.successful}</span>
              <span className="text-gray-500"> / </span>
              <span className="text-red-600">{data.apiRequests.failed}</span>
            </div>
            <div className="flex justify-between">
              <span>Avg Response Time</span>
              <Badge variant="outline">{data.apiRequests.avgResponseTime}ms</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Errors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Total Errors</span>
              <Badge variant="destructive">{data.errors.count}</Badge>
            </div>
            <div className="text-sm space-y-1">
              {data.errors.recent.slice(0, 3).map((error, i) => (
                <div key={i} className="text-gray-600 truncate">
                  {error.message}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Uptime</span>
              <Badge>{formatUptime(data.system.uptime)}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Memory Usage</span>
              <Badge>{data.system.memoryUsage.toFixed(1)}%</Badge>
            </div>
            <div className="flex justify-between">
              <span>Active Connections</span>
              <Badge>{data.system.activeConnections}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
