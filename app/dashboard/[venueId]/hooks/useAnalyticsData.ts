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

      // Fetch today's orders - we'll filter by payment_status in processing
      const { data: todayOrders, error: ordersError } = await supabase
        .from("orders")
        .select("created_at, items, total_amount, payment_status")
        .eq("venue_id", venueId)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: true });

      if (ordersError) throw ordersError;

      console.log("[ANALYTICS] Fetched today's orders:", {
        count: todayOrders?.length || 0,
        orders: todayOrders?.map((o: Record<string, unknown>) => ({
          id: o.id,
          payment_status: o.payment_status,
          total_amount: o.total_amount,
          hasItems: Array.isArray(o.items) && o.items.length > 0,
          itemsCount: Array.isArray(o.items) ? o.items.length : 0,
        })),
      });

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
      const { data: menuItems, error: menuItemsError } = await supabase
        .from("menu_items")
        .select("id, name, category")
        .eq("venue_id", venueId);

      if (menuItemsError) {
        console.error("[ANALYTICS] Error fetching menu items:", menuItemsError);
      }

      // Create maps for lookup: ID -> category and name -> category
      const menuItemCategoriesById = new Map<string, string>();
      const menuItemCategoriesByName = new Map<string, string>();
      (menuItems || []).forEach((item: Record<string, unknown>) => {
        const id = String(item.id || "").trim();
        const name = String(item.name || "").toLowerCase().trim();
        const category = String(item.category || "Other").trim();
        
        if (id) {
          menuItemCategoriesById.set(id, category);
          // Also store with lowercase for case-insensitive matching
          menuItemCategoriesById.set(id.toLowerCase(), category);
        }
        if (name) {
          menuItemCategoriesByName.set(name, category);
          // Also try variations: exact match, with/without special chars
          const normalizedName = name.replace(/[^\w\s]/g, "").trim();
          if (normalizedName && normalizedName !== name) {
            menuItemCategoriesByName.set(normalizedName, category);
          }
        }
      });

      console.log("[ANALYTICS] Menu items loaded:", {
        count: menuItems?.length || 0,
        sampleItems: (menuItems || []).slice(0, 3).map((item: Record<string, unknown>) => ({
          id: item.id,
          name: item.name,
          category: item.category,
        })),
        categoriesByIdSize: menuItemCategoriesById.size,
        categoriesByNameSize: menuItemCategoriesByName.size,
      });

      // Calculate revenue by category from order items using actual menu categories
      const categoryRevenue: { [key: string]: number } = {
        /* Empty */
      };
      
      let processedOrders = 0;
      let skippedOrders = 0;
      let itemsProcessed = 0;
      let itemsSkipped = 0;
      
      (todayOrders || []).forEach((order: Record<string, unknown>) => {
        // Only process paid orders
        const paymentStatus = (order.payment_status as string) || "";
        if (paymentStatus !== "PAID" && paymentStatus !== "TILL") {
          skippedOrders++;
          return;
        }

        // Check if order has items array
        if (!Array.isArray(order.items) || order.items.length === 0) {
          // If no items but order is paid, add to "Uncategorized" category
          const totalAmount = parseFloat((order.total_amount as string) || "0");
          if (totalAmount > 0) {
            categoryRevenue["Uncategorized"] = (categoryRevenue["Uncategorized"] || 0) + totalAmount;
            processedOrders++;
            console.log("[ANALYTICS] Order without items, using total_amount:", {
              orderId: order.id,
              totalAmount,
            });
          } else {
            skippedOrders++;
          }
          return;
        }

        processedOrders++;
        let orderHasValidItems = false;

        order.items.forEach((item: Record<string, unknown>) => {
          // Get category from menu items database
          const menuItemId = item.menu_item_id ? String(item.menu_item_id).trim() : null;
          const itemName = item.item_name ? String(item.item_name).toLowerCase().trim() : null;
          
          // Log the item for debugging
          console.log("[ANALYTICS] Processing item:", {
            menuItemId,
            itemName,
            itemCategory: item.category,
            allKeys: Object.keys(item),
          });
          
          // Try multiple lookup strategies
          let category: string | null = null;
          let lookupMethod = "";
          
          // Strategy 1: Lookup by menu_item_id (exact match)
          if (menuItemId && !category) {
            category = menuItemCategoriesById.get(menuItemId) || null;
            if (category) {
              lookupMethod = "menu_item_id (exact)";
            }
          }
          
          // Strategy 1b: Lookup by menu_item_id (case-insensitive)
          if (menuItemId && !category) {
            category = menuItemCategoriesById.get(menuItemId.toLowerCase()) || null;
            if (category) {
              lookupMethod = "menu_item_id (case-insensitive)";
            }
          }
          
          // Strategy 2: Lookup by item_name (exact match)
          if (!category && itemName) {
            category = menuItemCategoriesByName.get(itemName) || null;
            if (category) {
              lookupMethod = "item_name (exact)";
            }
          }
          
          // Strategy 2b: Lookup by item_name (normalized - remove special chars)
          if (!category && itemName) {
            const normalizedName = itemName.replace(/[^\w\s]/g, "").trim();
            category = menuItemCategoriesByName.get(normalizedName) || null;
            if (category) {
              lookupMethod = "item_name (normalized)";
            }
          }
          
          // Strategy 2c: Try partial match (contains)
          if (!category && itemName) {
            for (const [menuName, menuCategory] of menuItemCategoriesByName.entries()) {
              if (itemName.includes(menuName) || menuName.includes(itemName)) {
                category = menuCategory;
                lookupMethod = "item_name (partial match)";
                break;
              }
            }
          }
          
          // Strategy 3: Use item.category if present
          if (!category && typeof item.category === "string" && item.category.trim()) {
            category = item.category.trim();
            lookupMethod = "item.category field";
          }
          
          // Strategy 4: Default to "Other" only if all lookups fail
          if (!category) {
            category = "Other";
            lookupMethod = "default (Other)";
            console.warn("[ANALYTICS] No category found, using 'Other':", {
              menuItemId,
              itemName,
              itemCategory: item.category,
              availableMenuNames: Array.from(menuItemCategoriesByName.keys()).slice(0, 5),
            });
          } else {
            console.log("[ANALYTICS] Category found:", {
              category,
              method: lookupMethod,
              menuItemId,
              itemName,
            });
          }
          
          const price = parseFloat(
            typeof item.unit_price === "string"
              ? item.unit_price
              : typeof item.price === "string"
                ? item.price
                : typeof item.unitPrice === "number"
                  ? String(item.unitPrice)
                  : typeof item.unit_price === "number"
                    ? String(item.unit_price)
                    : "0"
          );
          
          const qty = parseInt(
            typeof item.quantity === "string"
              ? item.quantity
              : typeof item.qty === "string"
                ? item.qty
                : typeof item.quantity === "number"
                  ? String(item.quantity)
                  : typeof item.qty === "number"
                    ? String(item.qty)
                    : "1"
          );
          
          // Only add if we have valid price and quantity
          if (price > 0 && qty > 0) {
            const categoryKey = String(category || "Other");
            categoryRevenue[categoryKey] = (categoryRevenue[categoryKey] || 0) + price * qty;
            itemsProcessed++;
            orderHasValidItems = true;
          } else {
            itemsSkipped++;
            console.log("[ANALYTICS] Item skipped - invalid price or quantity:", {
              menuItemId,
              price,
              qty,
              item,
            });
          }
        });

        if (!orderHasValidItems) {
          // If order has items but none were valid, use total_amount as fallback
          const totalAmount = parseFloat((order.total_amount as string) || "0");
          if (totalAmount > 0) {
            categoryRevenue["Uncategorized"] = (categoryRevenue["Uncategorized"] || 0) + totalAmount;
            console.log("[ANALYTICS] Order with invalid items, using total_amount:", {
              orderId: order.id,
              totalAmount,
            });
          }
        }
      });

      console.log("[ANALYTICS] Revenue calculation summary:", {
        processedOrders,
        skippedOrders,
        itemsProcessed,
        itemsSkipped,
        categoryRevenue,
        menuItemsCount: menuItemCategoriesById.size,
      });

      const revenueByCategory = Object.entries(categoryRevenue)
        .map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      console.log("[ANALYTICS] Final revenueByCategory:", revenueByCategory);

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
