/**
 * Hook to fetch live analytics data for dashboard charts
 */

import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase";

interface AnalyticsData {
  ordersByHour: Array<{ hour: string; orders: number }>;
  revenueByCategory: Array<{ name: string; value: number; color: string }>;
  topSellingItems: Array<{ name: string; price: number; count: number }>;
  yesterdayComparison: {
    orders: number;
    revenue: number;
  };
}

const COLORS = ["#5B21B6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

export function useAnalyticsData(venueId: string) {
  // Cache analytics data to prevent flicker
  const getCachedAnalytics = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`analytics_data_${venueId}`);
    return cached ? JSON.parse(cached) : null;
  };

  const [data, setData] = useState<AnalyticsData | null>(getCachedAnalytics());
  const [loading, setLoading] = useState(false); // Start with false
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = supabaseBrowser();
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Compare apples-to-apples: same time period
      // If it's 2:49 PM today, compare today 12 AM - 2:49 PM vs yesterday 12 AM - 2:49 PM
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayEnd = new Date(
        yesterdayStart.getTime() + (now.getTime() - todayStart.getTime())
      );

      // Fetch today's orders
      const { data: todayOrders, error: ordersError } = await supabase
        .from("orders")
        .select("created_at, items, total_amount")
        .eq("venue_id", venueId)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: true });

      if (ordersError) throw ordersError;

      // Fetch yesterday's orders for comparison
      const { data: yesterdayOrders } = await supabase
        .from("orders")
        .select("created_at, total_amount")
        .eq("venue_id", venueId)
        .gte("created_at", yesterdayStart.toISOString())
        .lt("created_at", yesterdayEnd.toISOString());

      // Aggregate orders by hour
      const hourlyOrders: { [key: number]: number } = {};
      for (let i = 0; i < 24; i++) {
        hourlyOrders[i] = 0;
      }

      (todayOrders || []).forEach((order: Record<string, unknown>) => {
        const hour = new Date(order.created_at as string).getHours();
        if (hourlyOrders[hour] !== undefined) {
          hourlyOrders[hour]++;
        }
      });

      const ordersByHour = Object.entries(hourlyOrders).map(([hour, orders]) => ({
        hour: `${hour}:00`,
        orders,
      }));

      // Fetch menu items with categories
      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id, name, category")
        .eq("venue_id", venueId);

      // Create a map of menu item ID to category
      const menuItemCategories = new Map<string, string>();
      (menuItems || []).forEach((item: Record<string, unknown>) => {
        menuItemCategories.set(item.id as string, (item.category as string) || "Other");
      });

      // Calculate revenue by category from order items using actual menu categories
      const categoryRevenue: { [key: string]: number } = {};
      (todayOrders || []).forEach((order: Record<string, unknown>) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: Record<string, unknown>) => {
            // Get category from menu items database, not from order item
            const menuItemId = item.menu_item_id as string;
            const category = menuItemCategories.get(menuItemId) || item.category || "Other";
            const price = parseFloat((item.unit_price as string) || (item.price as string) || "0");
            const qty = parseInt((item.quantity as string) || (item.qty as string) || "1");
            categoryRevenue[category] = (categoryRevenue[category] || 0) + price * qty;
          });
        }
      });

      const revenueByCategory = Object.entries(categoryRevenue)
        .map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      // Get top selling items - count by QUANTITY added to cart (not number of orders)
      const itemCounts: { [key: string]: { name: string; price: number; count: number } } = {};
      (todayOrders || []).forEach((order: Record<string, unknown>) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: Record<string, unknown>) => {
            // Try item_name first (from orders API), then name, never "Unknown"
            const name = (item.item_name as string) || (item.name as string) || "Menu Item";
            const price = parseFloat((item.unit_price as string) || (item.price as string) || "0");
            const quantity = parseInt((item.quantity as string) || (item.qty as string) || "1");

            if (!itemCounts[name]) {
              itemCounts[name] = { name, price, count: 0 };
            }
            // Add the quantity (e.g., if someone orders 5x, add 5 to the count)
            itemCounts[name].count += quantity;
          });
        }
      });

      const topSellingItems = Object.values(itemCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate yesterday comparison
      const yesterdayOrdersCount = yesterdayOrders?.length || 0;
      const yesterdayRevenue = (yesterdayOrders || []).reduce((sum, order) => {
        return sum + (parseFloat(order.total_amount) || 0);
      }, 0);

      setData({
        ordersByHour,
        revenueByCategory,
        topSellingItems,
        yesterdayComparison: {
          orders: yesterdayOrdersCount,
          revenue: yesterdayRevenue,
        },
      });

      // Cache the analytics data
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `analytics_data_${venueId}`,
          JSON.stringify({
            ordersByHour,
            revenueByCategory,
            topSellingItems,
            yesterdayComparison: {
              orders: yesterdayOrdersCount,
              revenue: yesterdayRevenue,
            },
          })
        );
      }
    } catch (_err) {
      setError(err instanceof Error ? err.message : "Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
}
