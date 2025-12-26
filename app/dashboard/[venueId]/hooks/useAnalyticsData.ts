/**
 * Hook to fetch live analytics data for dashboard charts
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getRealtimeChannelName } from "@/lib/realtime-device-id";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function normalizeId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function parseOrderItems(rawItems: unknown): UnknownRecord[] {
  if (Array.isArray(rawItems)) {
    return rawItems.filter(isRecord);
  }

  // Some rows return items as a JSON string
  if (typeof rawItems === "string") {
    try {
      const parsed: unknown = JSON.parse(rawItems);
      return parseOrderItems(parsed);
    } catch {
      return [];
    }
  }

  // Some legacy shapes wrap items
  if (isRecord(rawItems)) {
    const maybeItems = rawItems.items;
    if (Array.isArray(maybeItems)) {
      return maybeItems.filter(isRecord);
    }
  }

  return [];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getPaymentStatusString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPaidStatus(paymentStatus: string): boolean {
  const normalized = paymentStatus.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "unpaid") return false;
  if (normalized === "refunded") return false;

  // Support multiple historical values
  return (
    normalized === "paid" ||
    normalized === "till" ||
    normalized === "cash" ||
    normalized === "card" ||
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "partial" ||
    normalized === "partially_paid" ||
    normalized === "partially-paid"
  );
}

function getItemRevenue(item: UnknownRecord): number | null {
  // Prefer subtotal when present (includes modifiers/discounts)
  const subtotal = toNumber(item.subtotal);
  if (subtotal !== null && subtotal > 0) return subtotal;

  const quantity = toNumber(item.quantity) ?? toNumber(item.qty) ?? toNumber(item.count) ?? 1;

  const unitPrice =
    toNumber(item.unit_price) ?? toNumber(item.unitPrice) ?? toNumber(item.price) ?? 0;

  if (quantity <= 0 || unitPrice <= 0) return null;
  return unitPrice * quantity;
}

export function buildRevenueByCategory(params: {
  orders: UnknownRecord[];
  menuItems: Array<{ id: string; category_id: string | null }>;
  categories: Array<{ id: string; name: string }>;
}): Array<{ name: string; value: number; color: string }> {
  const categoryNameById = new Map<string, string>();
  params.categories.forEach((c) => {
    const name = c.name.trim();
    if (!name) return;
    categoryNameById.set(c.id, name);
  });

  // Only allow categories that exist in menu_categories. We never emit "Other"/"Uncategorized".
  const menuItemIdToCategoryName = new Map<string, string>();
  params.menuItems.forEach((mi) => {
    if (!mi.category_id) return;
    const categoryName = categoryNameById.get(mi.category_id);
    if (!categoryName) return;
    menuItemIdToCategoryName.set(mi.id, categoryName);
  });

  const categoryRevenue = new Map<string, number>();

  params.orders.forEach((order) => {
    const status = getPaymentStatusString(order.payment_status);
    if (!isPaidStatus(status)) return;

    const items = parseOrderItems(order.items);
    if (items.length === 0) return;

    items.forEach((item) => {
      const revenue = getItemRevenue(item);
      if (revenue === null) return;

      const menuItemId =
        normalizeId(item.menu_item_id) ??
        normalizeId(item.menuItemId) ??
        normalizeId(item.menuItemID);

      if (!menuItemId) return;
      const categoryName = menuItemIdToCategoryName.get(menuItemId);
      if (!categoryName) return;
      categoryRevenue.set(categoryName, (categoryRevenue.get(categoryName) || 0) + revenue);
    });
  });

  const sorted = Array.from(categoryRevenue.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return sorted.map((entry, index) => ({
    ...entry,
    color: COLORS[index % COLORS.length],
  }));
}

export function useAnalyticsData(venueId: string) {
  // Always start without cached analytics data to avoid stale charts on first load
  // We still write to sessionStorage for potential future use, but we don't read from it
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false); // Start with false
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const isMountedRef = useRef(true);
  const fetchAnalyticsRef = useRef<(() => Promise<void>) | null>(null);

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

      if (ordersError) {
        logger.error("[dashboard analytics] failed to fetch today's orders", ordersError);
        throw ordersError;
      }

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

      // Fetch menu items + categories and build menu_item_id -> category name lookup
      const { data: menuItems, error: menuItemsError } = await supabase
        .from("menu_items")
        .select("id, category_id")
        .eq("venue_id", venueId);

      if (menuItemsError) {
        logger.error("[dashboard analytics] failed to fetch menu items", menuItemsError);
      }

      const { data: menuCategories, error: categoriesError } = await supabase
        .from("menu_categories")
        .select("id, name")
        .eq("venue_id", venueId);

      if (categoriesError) {
        logger.error("[dashboard analytics] failed to fetch menu categories", categoriesError);
      }

      const revenueByCategory = buildRevenueByCategory({
        orders: (todayOrders || []) as UnknownRecord[],
        menuItems:
          (menuItems || [])
            .map((mi: UnknownRecord) => ({
              id: normalizeId(mi.id) || "",
              category_id: normalizeId(mi.category_id),
            }))
            .filter((mi) => mi.id.length > 0) || [],
        categories:
          (menuCategories || [])
            .map((c: UnknownRecord) => ({
              id: normalizeId(c.id) || "",
              name: typeof c.name === "string" ? c.name : "Other",
            }))
            .filter((c) => c.id.length > 0) || [],
      });

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
      logger.error("[dashboard analytics] failed to fetch analytics", err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  // Store fetchAnalytics in ref for real-time subscription
  useEffect(() => {
    fetchAnalyticsRef.current = fetchAnalytics;
  }, [fetchAnalytics]);

  // Initial fetch
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, venueId]);

  // Real-time subscription for order changes
  useEffect(() => {
    isMountedRef.current = true;

    const supabase = supabaseBrowser();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Debounced refetch to avoid excessive API calls
    const debouncedRefetch = () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (fetchAnalyticsRef.current) {
          fetchAnalyticsRef.current();
        }
      }, 500); // 500ms debounce
    };

    // Set up session refresh listener to reconnect when token refreshes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" && channelRef.current) {
        // Token refreshed - ensure channel is still connected
        const channel = channelRef.current;
        if (channel && channel.state !== "joined") {
          // Reconnect if disconnected
          channel.subscribe();
        }
      }
    });
    authSubscriptionRef.current = authSubscription;

    const setupChannel = () => {
      // Use unique channel name with device ID to prevent conflicts
      const channelName = getRealtimeChannelName("analytics-realtime", venueId);
      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `venue_id=eq.${venueId}`,
          },
          (payload) => {
            if (!isMountedRef.current) return;

            const order = payload.new as {
              payment_status?: string;
              created_at?: string;
              total_amount?: number;
            } | null;

            // Only refetch if:
            // 1. New order was created today (INSERT)
            // 2. Order payment status changed to paid (UPDATE)
            // 3. Order was deleted (DELETE - rare but possible)
            if (payload.eventType === "INSERT") {
              const orderCreatedAt = order?.created_at;
              if (orderCreatedAt && new Date(orderCreatedAt) >= todayStart) {
                // New order created today - check if it's paid
                const status = getPaymentStatusString(order?.payment_status);
                if (isPaidStatus(status)) {
                  debouncedRefetch();
                }
              }
            } else if (payload.eventType === "UPDATE") {
              // Order updated - check if payment status changed to paid
              const oldOrder = payload.old as { payment_status?: string } | null;
              const oldStatus = getPaymentStatusString(oldOrder?.payment_status);
              const newStatus = getPaymentStatusString(order?.payment_status);

              // Only refetch if status changed to paid or from paid
              if (
                (isPaidStatus(newStatus) && !isPaidStatus(oldStatus)) ||
                (!isPaidStatus(newStatus) && isPaidStatus(oldStatus))
              ) {
                const orderCreatedAt = order?.created_at;
                if (orderCreatedAt && new Date(orderCreatedAt) >= todayStart) {
                  debouncedRefetch();
                }
              }
            } else if (payload.eventType === "DELETE") {
              // Order deleted - refetch to update analytics
              debouncedRefetch();
            }
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            channelRef.current = channel;
            logger.debug("[Analytics Realtime] Subscribed to order changes", { venueId });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logger.error("[Analytics Realtime] Channel error or timeout", { status, venueId });
            // Clear any existing reconnect timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }

            // Try to reconnect after a delay, but only if we still have a valid session
            reconnectTimeoutRef.current = setTimeout(async () => {
              try {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                if (session) {
                  // Session is valid, resubscribe
                  if (channelRef.current) {
                    channelRef.current.subscribe();
                  } else {
                    // Channel lost, recreate it
                    setupChannel();
                  }
                }
              } catch (_error) {
                // Session invalid - will need to refresh page or re-login
              }
            }, 3000);
          }
        });

      return channel;
    };

    const channel = setupChannel();
    channelRef.current = channel;

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
    };
  }, [venueId]);

  return { data, loading, error, refetch: fetchAnalytics };
}
