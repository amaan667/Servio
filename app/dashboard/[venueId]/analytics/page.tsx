/**
 * Analytics Dashboard
 * Provides business insights and performance metrics
 */

import { createAdminClient } from "@/lib/supabase";
import AnalyticsClientPage from "./AnalyticsClient";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";

export const metadata = {
  title: "Analytics | Servio",
  description: "Business analytics and insights for your venue",
};

export default async function AnalyticsPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Server-side auth check - NO REDIRECTS - Dashboard always loads
  const auth = await requirePageAuth(venueId).catch(() => null);

  // Fetch analytics data on server
  const [ordersData, menuData, revenueData] = await Promise.all([
    fetchOrderAnalytics(venueId),
    fetchMenuAnalytics(venueId),
    fetchRevenueAnalytics(venueId),
  ]);

  // Calculate trends on server from real data
  const trends = calculateTrends(ordersData, revenueData);

  // Calculate period comparison on server
  const periodComparison = calculatePeriodComparison(revenueData);

  const tier = auth?.tier ?? "starter";

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: !!auth,
    userId: auth?.user?.id,
    email: auth?.user?.email,
    tier: tier,
    role: auth?.role ?? "viewer",
    venueId: auth?.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Analytics",
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <AnalyticsClientPage
        venueId={venueId}
        ordersData={ordersData}
        menuData={menuData}
        revenueData={revenueData}
        trends={trends}
        periodComparison={periodComparison}
        currentTier={tier}
        
      />
    </>
  );
}

/**
 * Calculate trends from actual data
 */
function calculateTrends(ordersData: OrdersAnalytics, revenueData: RevenueAnalytics) {
  const revenueByDay = revenueData.revenueByDay || {};
  const dayKeys = Object.keys(revenueByDay).sort();
  const midPoint = Math.floor(dayKeys.length / 2);
  
  let currentPeriodRevenue = 0;
  let previousPeriodRevenue = 0;
  
  dayKeys.forEach((day, index) => {
    const revenue = revenueByDay[day] || 0;
    if (index >= midPoint) {
      currentPeriodRevenue += revenue;
    } else {
      previousPeriodRevenue += revenue;
    }
  });

  // Calculate revenue trend percentage from real data
  const revenueTrend = previousPeriodRevenue > 0 
    ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 
    : 0;

  // Calculate orders trend from actual data
  const firstHalfOrders = dayKeys.slice(0, midPoint).reduce((sum, day) => {
    return sum + (revenueByDay[day] || 0) / (ordersData.avgOrderValue || 1);
  }, 0);
  const secondHalfOrders = dayKeys.slice(midPoint).reduce((sum, day) => {
    return sum + (revenueByDay[day] || 0) / (ordersData.avgOrderValue || 1);
  }, 0);
  const ordersTrend = firstHalfOrders > 0 
    ? ((secondHalfOrders - firstHalfOrders) / firstHalfOrders) * 100 
    : 0;

  return {
    revenue: revenueTrend,
    orders: ordersTrend,
    aov: 0, // Would need historical AOV data
  };
}

/**
 * Calculate period comparison from real data
 */
function calculatePeriodComparison(revenueData: RevenueAnalytics) {
  const revenueByDay = revenueData.revenueByDay || {};
  const dayKeys = Object.keys(revenueByDay).sort();
  
  const today = new Date();
  let thisWeekRevenue = 0;
  let lastWeekRevenue = 0;
  
  dayKeys.forEach((dayStr) => {
    const dayDate = new Date(dayStr);
    const daysDiff = Math.floor((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
    const revenue = revenueByDay[dayStr] || 0;
    
    if (daysDiff <= 7) {
      thisWeekRevenue += revenue;
    } else if (daysDiff <= 14) {
      lastWeekRevenue += revenue;
    }
  });
  
  const change = lastWeekRevenue > 0 
    ? ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 
    : 0;
  
  return {
    thisWeek: thisWeekRevenue,
    lastWeek: lastWeekRevenue,
    change,
  };
}

interface OrdersAnalytics {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  avgOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByDay?: Record<string, number>;
}

interface MenuAnalytics {
  totalItems: number;
  activeItems: number;
  topSellingItems: Array<{
    name: string;
    quantity: number;
    revenue: number;
    category?: string;
    ordersCount?: number;
    price?: number;
  }>;
  itemsWithImages: number;
  itemsByCategory: Record<string, number>;
}

interface RevenueAnalytics {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  revenueByHour: unknown[];
  revenueByDay: Record<string, number>;
}

/**
 * Fetch order analytics
 */
async function fetchOrderAnalytics(venueId: string): Promise<OrdersAnalytics> {
  const supabase = createAdminClient();

  // Get orders from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at, total_amount, order_status, payment_status")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  const ordersByStatus = groupBy(orders || [], "order_status");
  const pendingStatuses = [
    "PLACED",
    "ACCEPTED",
    "IN_PREP",
    "READY",
    "SERVING",
    "placed",
    "accepted",
    "preparing",
    "ready",
  ];
  const completedStatuses = ["COMPLETED", "SERVED", "completed", "served"];

  const pendingOrders = Object.entries(ordersByStatus)
    .filter(([status]) => pendingStatuses.includes(status))
    .reduce((sum, [, count]) => sum + count, 0);

  const completedOrders = Object.entries(ordersByStatus)
    .filter(([status]) => completedStatuses.includes(status))
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    totalOrders: orders?.length || 0,
    pendingOrders,
    completedOrders,
    avgOrderValue:
      (orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0) / (orders?.length || 1),
    ordersByStatus,
    ordersByDay: groupByDay(orders || []),
  };
}

/**
 * Fetch menu analytics
 */
async function fetchMenuAnalytics(venueId: string): Promise<MenuAnalytics> {
  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, category, price, image_url, is_available")
    .eq("venue_id", venueId);

  if (!menuItems || menuItems.length === 0) {
    return {
      totalItems: 0,
      activeItems: 0,
      topSellingItems: [],
      itemsWithImages: 0,
      itemsByCategory: {},
    };
  }

  // Get orders with items JSONB array
  const { data: orders } = await supabase
    .from("orders")
    .select("items")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .neq("order_status", "CANCELLED")
    .neq("order_status", "REFUNDED");

  // Calculate popularity by parsing items JSONB array
  const itemStatsMap = new Map<
    string,
    { quantity: number; revenue: number; name: string; category: string; price: number }
  >();

  interface OrderWithItems {
    items: Array<{
      menu_item_id: string;
      item_name: string;
      quantity: number;
      price: number;
    }>;
  }

  (orders as unknown as OrderWithItems[] | null)?.forEach((order) => {
    if (!order.items || !Array.isArray(order.items)) return;

    order.items.forEach((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menu_item_id);
      if (!menuItem) return;

      const current = itemStatsMap.get(item.menu_item_id) || {
        quantity: 0,
        revenue: 0,
        name: menuItem.name,
        category: menuItem.category,
        price: menuItem.price,
      };
      current.quantity += item.quantity;
      current.revenue += item.quantity * (item.price || 0);
      itemStatsMap.set(item.menu_item_id, current);
    });
  });

  const topItems = Array.from(itemStatsMap.values())
    .map((stats) => ({
      name: stats.name,
      quantity: stats.quantity,
      revenue: stats.revenue,
      category: stats.category,
      ordersCount: stats.quantity,
      price: stats.price,
    }))
    .sort((a, b) => b.ordersCount - a.ordersCount)
    .slice(0, 10);

  return {
    totalItems: menuItems?.length || 0,
    activeItems: menuItems?.filter((i) => i.is_available).length || 0,
    topSellingItems: topItems,
    itemsWithImages: menuItems?.filter((i) => i.image_url).length || 0,
    itemsByCategory: groupBy(menuItems || [], "category"),
  };
}

/**
 * Fetch revenue analytics
 */
async function fetchRevenueAnalytics(venueId: string): Promise<RevenueAnalytics> {
  const supabase = createAdminClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, created_at, payment_status, order_status")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .neq("order_status", "CANCELLED")
    .neq("order_status", "REFUNDED");

  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const totalOrders = orders?.length || 0;

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue: totalRevenue / (totalOrders || 1),
    revenueByDay: groupByDay(orders || [], "total_amount"),
    revenueByHour: [],
  };
}

/**
 * Group array by property
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, number> {
  return array.reduce(
    (acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Group by day for time series
 */
function groupByDay(
  array: Array<Record<string, unknown>>,
  sumKey?: string
): Record<string, number> {
  return array.reduce<Record<string, number>>((acc, item) => {
    const date = (new Date(item.created_at as string).toISOString().split("T")[0] ?? "") as string;
    const value = sumKey ? (item[sumKey] as number) || 0 : 1;
    acc[date] = (acc[date] ?? 0) + value;
    return acc;
  }, {});
}
