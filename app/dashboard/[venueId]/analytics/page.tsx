/**
 * Analytics Dashboard
 * Provides business insights and performance metrics
 *
 * ARCHITECTURE NOTE:
 * Like the main dashboard, this page fetches data on the SERVER using
 * admin privileges (no auth required) and passes it to a CLIENT component
 * that handles auth checking in the browser where cookies work properly.
 *
 * This avoids the "Auth session missing!" error that happens when trying
 * to read user session cookies in server components.
 */

import { createAdminClient } from "@/lib/supabase";
import AnalyticsClient from "./AnalyticsClient";

export const metadata = {
  title: "Analytics | Servio",
  description: "Business analytics and insights for your venue",
};

export default async function AnalyticsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Fetch analytics data on server WITHOUT auth (use admin client like dashboard does)
  // The AnalyticsClient component will handle auth checking in the browser
  const [ordersData, menuData, revenueData] = await Promise.all([
    fetchOrderAnalytics(venueId),
    fetchMenuAnalytics(venueId),
    fetchRevenueAnalytics(venueId),
  ]);

  return (
    <AnalyticsClient
      venueId={venueId}
      ordersData={ordersData}
      menuData={menuData}
      revenueData={revenueData}
    />
  );
}

/**
 * Fetch order analytics
 */
async function fetchOrderAnalytics(venueId: string) {
  const supabase = createAdminClient();

  // Get orders from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at, total_amount, status, payment_status")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  const ordersByStatus = groupBy(orders || [], "status");
  const pendingStatuses = ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"];
  const completedStatuses = ["COMPLETED", "SERVED"];
  
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
    recentOrders: orders?.slice(0, 10) || [],
  };
}

/**
 * Fetch menu analytics
 */
async function fetchMenuAnalytics(venueId: string) {
  const supabase = createAdminClient();

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, category, price, image_url, is_available")
    .eq("venue_id", venueId);

  // Get order items to find popular items
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity")
    .in("menu_item_id", menuItems?.map((i) => i.id) || []);

  // Calculate popularity
  const popularityMap = new Map<string, number>();
  orderItems?.forEach((item) => {
    const current = popularityMap.get(item.menu_item_id) || 0;
    popularityMap.set(item.menu_item_id, current + item.quantity);
  });

  const topItems = (menuItems || [])
    .map((item) => {
      const quantity = popularityMap.get(item.id) || 0;
      const revenue = quantity * (item.price || 0);
      return {
        name: item.name,
        quantity,
        revenue,
        category: item.category,
        ordersCount: quantity,
        price: item.price,
      };
    })
    .sort((a, b) => b.ordersCount - a.ordersCount)
    .slice(0, 10);

  return {
    totalItems: menuItems?.length || 0,
    activeItems: menuItems?.filter((i) => i.is_available).length || 0,
    itemsByCategory: groupBy(menuItems || [], "category"),
    itemsWithImages: menuItems?.filter((i) => i.image_url).length || 0,
    unavailableItems: menuItems?.filter((i) => !i.is_available).length || 0,
    topSellingItems: topItems,
  };
}

/**
 * Fetch revenue analytics
 */
async function fetchRevenueAnalytics(venueId: string) {
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

  // Calculate revenue from all non-cancelled orders (matches dashboard logic)
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const totalOrders = orders?.length || 0;

  return {
    totalRevenue,
    totalOrders,
    avgOrderValue: totalRevenue / (totalOrders || 1),
    averageOrderValue: totalRevenue / (totalOrders || 1),
    revenueByDay: groupByDay(orders || [], "total_amount"),
    revenueByHour: [], // Placeholder - can be calculated if needed
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
function groupByDay(array: Array<Record<string, unknown>>, sumKey?: string): Record<string, number> {
  return array.reduce<Record<string, number>>(
    (acc, item) => {
      const date = new Date(item.created_at as string).toISOString().split("T")[0];
      const value = sumKey ? (item[sumKey] as number) || 0 : 1;
      acc[date] = (acc[date] || 0) + value;
      return acc;
    },
    {}
  );
}
