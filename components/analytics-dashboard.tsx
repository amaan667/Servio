"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  RefreshCw,
  Clock,
  Star,
  TrendingDown,
  CheckCircle,
} from "lucide-react";
import { supabaseBrowser as createClient } from "@/lib/supabase";
import { ChartContainer } from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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

interface ChartData {
  name: string;
  value: number;
  revenue?: number;
  orders?: number;
}

export function AnalyticsDashboard({ venueId }: AnalyticsDashboardProps) {
  const [stats, setStats] = useState({
    revenue: 0,
    orderCount: 0,
    activeTables: 0,
    unpaidOrders: 0,
    averageOrderValue: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month">("today");
  const [hourlyData, setHourlyData] = useState<ChartData[]>([]);
  const [topItems, setTopItems] = useState<ChartData[]>([]);
  const [customerFrequency, setCustomerFrequency] = useState<ChartData[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<ChartData[]>([]);
  const [dayOfWeekData, setDayOfWeekData] = useState<ChartData[]>([]);
  const [categoryPerformance, setCategoryPerformance] = useState<ChartData[]>([]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  const calculateStats = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Calculate date range based on selection
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }

      // Fetch orders from database
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", startDate.toISOString());

      if (ordersError) {
        setStats({
          revenue: 0,
          orderCount: 0,
          activeTables: 0,
          unpaidOrders: 0,
          averageOrderValue: 0,
          completionRate: 0,
        });
        return;
      }

      const orders: OrderWithItems[] = ordersData || [];
      // Map menu item id -> category for category performance
      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id, category")
        .eq("venue_id", venueId);
      const itemIdToCategory = new Map<string, string>();
      (menuItems || []).forEach((mi: Record<string, unknown>) => {
        const id = mi?.id as string | undefined;
        const category = mi?.category as string | undefined;
        if (id) itemIdToCategory.set(id, category || "Other");
      });
      const filteredOrders = orders.filter((order) => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate && order.order_status !== "CANCELLED";
      });

      // Calculate basic stats
      const revenue = filteredOrders.reduce((acc, order) => {
        let amount = order.total_amount;
        if (!amount || amount <= 0) {
          amount = order.items.reduce((sum, item) => {
            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            return sum + quantity * price;
          }, 0);
        }
        return acc + amount;
      }, 0);

      const orderCount = filteredOrders.length;
      const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0;

      // Active tables calculation
      const activeTables = new Set(
        filteredOrders.filter((o) => o.order_status !== "COMPLETED").map((o) => o.table_number)
      ).size;

      // Unpaid orders
      const unpaidOrders = filteredOrders.filter((o) => o.payment_status === "UNPAID").length;

      // Completion rate
      const completedOrders = filteredOrders.filter((o) => o.order_status === "COMPLETED").length;
      const completionRate = orderCount > 0 ? (completedOrders / orderCount) * 100 : 0;

      setStats({
        revenue,
        orderCount,
        activeTables,
        unpaidOrders,
        averageOrderValue,
        completionRate,
      });

      // Calculate hourly data
      const hourlyStats = new Array(24).fill(0).map((_, hour) => ({
        name: `${hour}:00`,
        value: 0,
        revenue: 0,
        orders: 0,
      }));

      filteredOrders.forEach((order) => {
        const orderHour = new Date(order.created_at).getHours();
        if (hourlyStats[orderHour]) {
          hourlyStats[orderHour].value += 1;
          hourlyStats[orderHour].orders += 1;
        }

        let amount = order.total_amount;
        if (!amount || amount <= 0) {
          amount = order.items.reduce((sum, item) => {
            const quantity = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            return sum + quantity * price;
          }, 0);
        }
        hourlyStats[orderHour]!.revenue += amount;
      });

      setHourlyData(hourlyStats);

      // Calculate top-selling items
      const itemStats: { [key: string]: { quantity: number; revenue: number } } = {
        /* Empty */
      };
      const categoryStats: { [key: string]: { quantity: number; revenue: number } } = {
        /* Empty */
      };
      filteredOrders.forEach((order) => {
        order.items.forEach((item) => {
          if (!itemStats[item.item_name]) {
            itemStats[item.item_name] = { quantity: 0, revenue: 0 };
          }
          const itemStat = itemStats[item.item_name];
          if (itemStat) {
            itemStat.quantity += item.quantity;
            itemStat.revenue += item.quantity * item.price;
          }

          const cat = itemIdToCategory.get(item.menu_item_id) || "Other";
          if (!categoryStats[cat]) categoryStats[cat] = { quantity: 0, revenue: 0 };
          const catStat = categoryStats[cat];
          if (catStat) {
            catStat.quantity += item.quantity;
            catStat.revenue += item.quantity * item.price;
          }
        });
      });

      const topItemsData = Object.entries(itemStats)
        .map(([name, stats]) => ({
          name,
          value: stats.quantity,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setTopItems(topItemsData);

      // Category performance
      const categoryData = Object.entries(categoryStats)
        .map(([name, stats]) => ({ name, value: stats.quantity, revenue: stats.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      setCategoryPerformance(categoryData);

      // Calculate customer frequency
      const customerStats: { [key: string]: number } = {
        /* Empty */
      };
      filteredOrders.forEach((order) => {
        const customerKey = order.customer_phone || order.customer_email || order.customer_name;
        customerStats[customerKey] = (customerStats[customerKey] || 0) + 1;
      });

      const customerFrequencyData = Object.entries(customerStats)
        .map(([customer, frequency]) => ({
          name: customer.length > 20 ? customer.substring(0, 20) + "..." : customer,
          value: frequency,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setCustomerFrequency(customerFrequencyData);

      // Calculate revenue trend (last 7 days)
      if (timeRange === "week") {
        const dailyRevenue: { [key: string]: number } = {
          /* Empty */
        };
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateKey = date.toISOString().split("T")[0]!;
          dailyRevenue[dateKey] = 0;
        }

        filteredOrders.forEach((order) => {
          const orderDate = order.created_at.split("T")[0]!;
          if (dailyRevenue[orderDate] !== undefined) {
            let amount = order.total_amount;
            if (!amount || amount <= 0) {
              amount = order.items.reduce((sum, item) => {
                const quantity = Number(item.quantity) || 0;
                const price = Number(item.price) || 0;
                return sum + quantity * price;
              }, 0);
            }
            dailyRevenue[orderDate]! += amount;
          }
        });

        const revenueTrendData = Object.entries(dailyRevenue).map(([date, revenue]) => ({
          name: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
          value: revenue,
        }));

        setRevenueTrend(revenueTrendData);
      }

      // Day-of-week breakdown
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
      const dow = new Array(7)
        .fill(null)
        .map((_, i) => ({ name: days[i]!, value: 0, revenue: 0, orders: 0 }));
      filteredOrders.forEach((order) => {
        const d = new Date(order.created_at).getDay();
        dow[d]!.orders += 1;
        dow[d]!.value += 1;
        let amt = order.total_amount;
        if (!amt || amt <= 0) {
          amt = order.items.reduce(
            (s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0),
            0
          );
        }
        dow[d]!.revenue += amt;
      });
      setDayOfWeekData(dow);
    } catch (_error) {
      setStats({
        revenue: 0,
        orderCount: 0,
        activeTables: 0,
        unpaidOrders: 0,
        averageOrderValue: 0,
        completionRate: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [venueId, timeRange]);

  useEffect(() => {
    calculateStats();
  }, [calculateStats]);

  // Set up real-time subscription for instant analytics updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`analytics-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload: {
          eventType: string;
          new?: Record<string, unknown>;
          old?: Record<string, unknown>;
        }) => {
          // Check if the order is within the current time range
          const orderCreatedAt = payload.new?.created_at || payload.old?.created_at;
          if (!orderCreatedAt || typeof orderCreatedAt !== "string") return;

          const now = new Date();
          let startDate: Date;

          switch (timeRange) {
            case "today":
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              break;
            case "week":
              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              break;
            case "month":
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            default:
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          }

          const orderDate = new Date(orderCreatedAt);
          const isInTimeRange = orderDate >= startDate;

          if (isInTimeRange) {
            // Reduce debounce time for faster updates
            setTimeout(() => {
              calculateStats();
            }, 200);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, timeRange, calculateStats]);

  interface StatCardProps {
    title: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    formatAsCurrency?: boolean;
    subtitle?: string;
    trend?: number;
  }

  const StatCard = ({
    title,
    value,
    icon: Icon,
    formatAsCurrency = false,
    subtitle,
    trend,
  }: StatCardProps) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-gray-800" />
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
        {subtitle && <p className="text-xs text-red-600 mt-1">{subtitle}</p>}
        {trend && (
          <div
            className={`flex items-center text-xs mt-1 ${trend > 0 ? "text-green-600" : "text-red-600"}`}
          >
            {trend > 0 ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {Math.abs(trend)}%
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium">Time Range:</span>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as "today" | "week" | "month")}
          className="border rounded px-3 py-1 text-sm"
        >
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Basic Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            {timeRange === "today"
              ? "Today's Analytics"
              : timeRange === "week"
                ? "Last 7 Days Analytics"
                : "This Month's Analytics"}
            <RefreshCw
              className={`h-4 w-4 text-gray-800 cursor-pointer ${loading ? "animate-spin" : ""}`}
              onClick={calculateStats}
            />
          </CardTitle>
          <CardDescription>A comprehensive summary of your performance metrics.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            <StatCard
              title="Revenue"
              value={stats.revenue}
              icon={TrendingUp}
              formatAsCurrency
              subtitle={stats.unpaidOrders > 0 ? `${stats.unpaidOrders} unpaid` : undefined}
            />
            <StatCard title="Orders" value={stats.orderCount} icon={ShoppingBag} />
            <StatCard title="Active Tables" value={stats.activeTables} icon={Users} />
            <StatCard
              title="Avg Order Value"
              value={stats.averageOrderValue}
              icon={Star}
              formatAsCurrency
            />
            <StatCard
              title="Completion Rate"
              value={parseFloat(stats.completionRate.toFixed(1))}
              icon={CheckCircle}
              subtitle="%"
            />
            <StatCard
              title="Peak Hour"
              value={
                hourlyData.length > 0
                  ? parseFloat(
                      hourlyData.reduce((max, hour) =>
                        (hour.orders || 0) > (max.orders || 0) ? hour : max
                      ).name || "0"
                    )
                  : 0
              }
              icon={Clock}
            />
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Hourly Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Hourly Activity</CardTitle>
            <CardDescription>Orders and revenue by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] md:h-[300px] mb-2 md:mb-4">
              <ChartContainer
                config={{
                  orders: { color: "#3b82f6" },
                  revenue: { color: "#10b981" },
                }}
              >
                <ResponsiveContainer width="100%" height="100%" maxHeight={330}>
                  <BarChart data={hourlyData} margin={{ left: 20, right: 30, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="orders" fill="#3b82f6" name="Orders" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Selling Items (quantity and revenue side-by-side) */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
            <CardDescription>Quantity and revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[450px] md:h-[400px] mb-2 md:mb-4">
              <ChartContainer
                config={{
                  qty: { color: "#8b5cf6" },
                  rev: { color: "#10b981" },
                }}
              >
                <ResponsiveContainer width="100%" height="100%" maxHeight={430}>
                  <BarChart
                    data={topItems}
                    layout="horizontal"
                    margin={{ left: 140, right: 40, top: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={130}
                      tick={{ fontSize: 12 }}
                      tickLine={{ stroke: "#666", strokeWidth: 1 }}
                    />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" name="Qty" />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue (£)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trend (for week view) */}
        {timeRange === "week" && (
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily revenue over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] md:h-[300px] mb-2 md:mb-4">
                <ChartContainer
                  config={{
                    revenue: { color: "#10b981" },
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%" maxHeight={330}>
                    <LineChart
                      data={revenueTrend}
                      margin={{ left: 20, right: 30, top: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Customer Frequency */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Frequency</CardTitle>
            <CardDescription>Most frequent customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] md:h-[300px] mb-2 md:mb-4">
              <ChartContainer
                config={{
                  customers: { color: "#f59e0b" },
                }}
              >
                <ResponsiveContainer width="100%" height="100%" maxHeight={330}>
                  <PieChart margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
                    <Pie
                      data={customerFrequency}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={90}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {customerFrequency.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Day-of-week breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Day-of-Week Performance</CardTitle>
            <CardDescription>Which day performs best</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] md:h-[300px] mb-2 md:mb-4">
              <ChartContainer
                config={{ orders: { color: "#6366f1" }, revenue: { color: "#10b981" } }}
              >
                <ResponsiveContainer width="100%" height="100%" maxHeight={330}>
                  <BarChart
                    data={dayOfWeekData}
                    margin={{ left: 20, right: 30, top: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="orders" fill="#6366f1" name="Orders" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category performance */}
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Drinks vs Mains vs Desserts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] md:h-[350px] mb-2 md:mb-4">
              <ChartContainer config={{ qty: { color: "#8b5cf6" }, revenue: { color: "#10b981" } }}>
                <ResponsiveContainer width="100%" height="100%" maxHeight={380}>
                  <BarChart
                    data={categoryPerformance}
                    layout="horizontal"
                    margin={{ left: 120, right: 40, top: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={110}
                      tick={{ fontSize: 12 }}
                      tickLine={{ stroke: "#666", strokeWidth: 1 }}
                    />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" name="Qty" />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue (£)" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
