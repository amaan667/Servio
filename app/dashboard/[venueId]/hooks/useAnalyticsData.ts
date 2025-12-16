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
  // Always start without cached analytics data to avoid stale charts on first load
  // We still write to sessionStorage for potential future use, but we don't read from it
  const [data, setData] = useState<AnalyticsData | null>(null);
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

      // Fetch today's orders - only count PAID orders for revenue
      const { data: todayOrders, error: ordersError } = await supabase
        .from("orders")
        .select("created_at, items, total_amount, payment_status")
        .eq("venue_id", venueId)
        .gte("created_at", todayStart.toISOString())
        .in("payment_status", ["PAID", "TILL"]) // Only count paid orders for revenue
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
      const hourlyOrders: { [key: number]: number } = {
        /* Empty */
      };
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
      const categoryRevenue: { [key: string]: number } = {
        /* Empty */
      };
      
      (todayOrders || []).forEach((order: Record<string, unknown>) => {
        // Only process paid orders
        const paymentStatus = (order.payment_status as string) || "";
        if (paymentStatus !== "PAID" && paymentStatus !== "TILL") {
          return;
        }

        // Check if order has items array
        if (!Array.isArray(order.items) || order.items.length === 0) {
          // If no items, we can't categorize, but we could add to "Uncategorized"
          // For now, skip orders without items
          return;
        }

        order.items.forEach((item: Record<string, unknown>) => {
          // Get category from menu items database, not from order item
          const menuItemId = item.menu_item_id as string;
          if (!menuItemId) {
            // Skip items without menu_item_id
            return;
          }

          const category =
            menuItemCategories.get(menuItemId) ||
            (typeof item.category === "string" ? item.category : "Other");
          
          const price = parseFloat(
            typeof item.unit_price === "string"
              ? item.unit_price
              : typeof item.price === "string"
                ? item.price
                : typeof item.unitPrice === "number"
                  ? String(item.unitPrice)
                  : "0"
          );
          
          const qty = parseInt(
            typeof item.quantity === "string"
              ? item.quantity
              : typeof item.qty === "string"
                ? item.qty
                : typeof item.quantity === "number"
                  ? String(item.quantity)
                  : "1"
          );
          
          // Only add if we have valid price and quantity
          if (price > 0 && qty > 0) {
            const categoryKey = String(category || "Other");
            categoryRevenue[categoryKey] = (categoryRevenue[categoryKey] || 0) + price * qty;
          }
        });
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
      const itemCounts: { [key: string]: { name: string; price: number; count: number } } = {
        /* Empty */
      };
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch analytics";
      console.error("[ANALYTICS] Error fetching analytics data:", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, refetch: fetchAnalytics };
}
