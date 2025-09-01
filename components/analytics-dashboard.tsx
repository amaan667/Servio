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
import { createClient } from "@/lib/supabase/client";

interface OrderWithItems {
  id: string;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  total_amount: number;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface AnalyticsDashboardProps {
  venueId: string;
}

export function AnalyticsDashboard({ venueId }: AnalyticsDashboardProps) {
  const [stats, setStats] = useState({
    revenue: 0,
    orderCount: 0,
    activeTables: 0,
    unpaidOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  const calculateStats = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Fetch orders from database
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", new Date().toISOString().split('T')[0]); // Today's orders

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        setStats({ revenue: 0, orderCount: 0, activeTables: 0, unpaidOrders: 0 });
        return;
      }

      const orders: OrderWithItems[] = ordersData || [];
      const todaysOrders = orders.filter((order) => {
        const orderDate = new Date(order.created_at).toDateString();
        const today = new Date().toDateString();
        return orderDate === today && order.order_status !== "CANCELLED";
      });

      const revenue = todaysOrders.reduce(
        (acc, order) => acc + order.total_amount,
        0,
      );
      const orderCount = todaysOrders.length;
      
      // Active tables are those with orders not fully processed (not COMPLETED)
      const activeTables = new Set(
        todaysOrders
          .filter((o) => o.order_status !== "COMPLETED")
          .map((o) => o.table_number),
      ).size;

      // Count unpaid orders
      const unpaidOrders = todaysOrders.filter((o) => o.payment_status === "UNPAID").length;

      setStats({ revenue, orderCount, activeTables, unpaidOrders });
    } catch (error) {
      console.error("Error calculating stats:", error);
      setStats({ revenue: 0, orderCount: 0, activeTables: 0, unpaidOrders: 0 });
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    formatAsCurrency = false,
    subtitle,
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
        {subtitle && (
          <p className="text-xs text-red-600 mt-1">{subtitle}</p>
        )}
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
            subtitle={stats.unpaidOrders > 0 ? `${stats.unpaidOrders} unpaid` : undefined}
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
