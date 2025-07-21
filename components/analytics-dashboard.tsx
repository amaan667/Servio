"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingUp, ShoppingBag, Users, RefreshCw } from "lucide-react";
import type { OrderWithItems } from "@/lib/supabase";

interface AnalyticsDashboardProps {
  venueId: string;
}

export function AnalyticsDashboard({ venueId }: AnalyticsDashboardProps) {
  const [stats, setStats] = useState({
    revenue: 0,
    orderCount: 0,
    activeTables: 0,
  });
  const [loading, setLoading] = useState(true);

  const calculateStats = useCallback(() => {
    setLoading(true);
    try {
      const localOrders: OrderWithItems[] = JSON.parse(
        localStorage.getItem(`servio-orders-${venueId}`) || "[]",
      );

      const todaysOrders = localOrders.filter((order) => {
        const orderDate = new Date(order.created_at).toDateString();
        const today = new Date().toDateString();
        return orderDate === today && order.status !== "cancelled";
      });

      const revenue = todaysOrders.reduce(
        (acc, order) => acc + order.total_amount,
        0,
      );
      const orderCount = todaysOrders.length;
      const activeTables = new Set(
        todaysOrders
          .filter((o) => o.status !== "completed")
          .map((o) => o.table_number),
      ).size;

      setStats({ revenue, orderCount, activeTables });
    } catch (error) {
      console.error("Error calculating stats:", error);
      setStats({ revenue: 0, orderCount: 0, activeTables: 0 });
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    calculateStats();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `servio-orders-${venueId}`) {
        calculateStats();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [calculateStats]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    formatAsCurrency = false,
  }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
          ) : formatAsCurrency ? (
            `£${value.toFixed(2)}`
          ) : (
            value
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Today's Analytics
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground cursor-pointer ${loading ? "animate-spin" : ""}`}
            onClick={calculateStats}
          />
        </CardTitle>
        <CardDescription>
          A real-time summary of today's performance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Today's Revenue"
            value={stats.revenue}
            icon={TrendingUp}
            formatAsCurrency
          />
          <StatCard
            title="Today's Orders"
            value={stats.orderCount}
            icon={ShoppingBag}
          />
          <StatCard
            title="Active Tables"
            value={stats.activeTables}
            icon={Users}
          />
        </div>
      </CardContent>
    </Card>
  );
}
