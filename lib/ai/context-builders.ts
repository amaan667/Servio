// Servio AI Assistant - Context Builders (RAG Layer)
// Gathers and summarizes data for LLM planning

import { createClient } from "@/lib/supabase";
import { aiLogger } from "@/lib/logger";
import {
  MenuSummary,
  InventorySummary,
  OrdersSummary,
  AnalyticsSummary,
  AIAssistantContext,
} from "@/types/ai-assistant";

// Cache TTL in seconds
const CACHE_TTL = 60; // 1 minute

// ============================================================================
// Get Full Assistant Context
// ============================================================================

export async function getAssistantContext(
  venueId: string,
  userId: string,
  providedUserRole?: string
): Promise<AIAssistantContext> {
  const supabase = await createClient();

  let userRole = providedUserRole || "staff";

  // Get user role if not provided
  if (!providedUserRole) {
    try {
      const { data: roleData } = await supabase
        .from("user_venue_roles")
        .select("role")
        .eq("venue_id", venueId)
        .eq("user_id", userId)
        .single();

      if (roleData) {
        userRole = roleData.role;
      }
    } catch (_error) {
      // Table doesn't exist or other error - use default
      aiLogger.debug("[AI ASSISTANT] Could not get user role:", _error);
    }
  }

  // Get venue details including opening hours
  const { data: venueData } = await supabase
    .from("venues")
    .select(
      "tier, timezone, kds_enabled, inventory_enabled, operating_hours, venue_name, address, phone, email"
    )
    .eq("venue_id", venueId)
    .single();

  return {
    venueId,
    userId,
    userRole,
    venueTier: venueData?.tier || "starter",
    timezone: venueData?.timezone || "UTC",
    venueName: venueData?.venue_name || "Unknown Venue",
    address: venueData?.address || null,
    phone: venueData?.phone || null,
    email: venueData?.email || null,
    operatingHours: venueData?.operating_hours || null,
    features: {
      kdsEnabled: venueData?.kds_enabled || false,
      inventoryEnabled: venueData?.inventory_enabled || false,
      analyticsEnabled: true, // Always enabled
    },
  };
}

// ============================================================================
// Menu Summary Builder
// ============================================================================

export async function getMenuSummary(venueId: string, useCache = true): Promise<MenuSummary> {
  const supabase = await createClient();

  // Check cache first
  if (useCache) {
    const cached = await getCachedContext(venueId, "menu_summary");
    if (cached) return cached as MenuSummary;
  }

  // Get total items and categories with image data
  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, price, category, image_url, is_available")
    .eq("venue_id", venueId)
    .eq("is_available", true);

  if (!items || items.length === 0) {
    return {
      totalItems: 0,
      categories: [],
      topSellers: [],
      allItems: [], // Added: required by MenuSummary interface
      avgPrice: 0,
      priceRange: { min: 0, max: 0 },
      itemsWithImages: 0,
      itemsWithoutImages: 0,
    };
  }

  // Count items with/without images
  const itemsWithImages = items.filter((item: Record<string, unknown>) => {
    const imageUrl = item.image_url as string | null | undefined;
    return imageUrl && imageUrl.trim() !== "";
  }).length;
  const itemsWithoutImages = items.length - itemsWithImages;

  // Get sales data for last 7 days from orders.items JSONB
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: orders } = await supabase
    .from("orders")
    .select("items")
    .eq("venue_id", venueId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  // Calculate sales per item from JSONB array
  const salesMap = new Map<
    string,
    { sales: number; revenue: number; name: string; price: number }
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
      const menuItem = items.find((i) => i.id === item.menu_item_id);
      if (!menuItem) return;

      const existing = salesMap.get(item.menu_item_id) || {
        sales: 0,
        revenue: 0,
        name: menuItem.name as string,
        price: menuItem.price as number,
      };
      salesMap.set(item.menu_item_id, {
        sales: existing.sales + item.quantity,
        revenue: existing.revenue + item.quantity * item.price,
        name: menuItem.name as string,
        price: menuItem.price as number,
      });
    });
  });

  // Get top sellers
  const topSellers = Array.from(salesMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      price: data.price,
      sales7d: data.sales,
      revenue7d: data.revenue,
    }))
    .sort((a, b) => b.revenue7d - a.revenue7d)
    .slice(0, 10);

  // Calculate category counts
  const categoryMap = new Map<string, { name: string; count: number }>();
  items.forEach((item: Record<string, unknown>) => {
    const category = item.category as string | undefined;
    if (category) {
      const existing = categoryMap.get(category) || {
        name: category,
        count: 0,
      };
      categoryMap.set(category, {
        ...existing,
        count: existing.count + 1,
      });
    }
  });

  const categories = Array.from(categoryMap.values()).map((cat) => ({
    id: cat.name, // Use category name as ID since there's no separate categories table
    name: cat.name,
    itemCount: cat.count,
  }));

  // Calculate price stats
  const prices = items.map((i) => i.price);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Create list of all items for AI to reference
  const allItems = items.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    name: item.name as string,
    price: item.price as number,
    categoryId: (item.category as string) || "", // Use category name as ID since there's no separate categories table
    categoryName: (item.category as string) || "Uncategorized",
  }));

  const summary: MenuSummary = {
    totalItems: items.length,
    categories,
    topSellers,
    allItems, // Added: full list of all menu items for AI to reference
    avgPrice: Number(avgPrice.toFixed(2)),
    priceRange: { min: minPrice, max: maxPrice },
    itemsWithImages,
    itemsWithoutImages,
  };

  // Cache for 1 minute
  await cacheContext(venueId, "menu_summary", summary as unknown as Record<string, unknown>);

  return summary;
}

// ============================================================================
// Inventory Summary Builder
// ============================================================================

export async function getInventorySummary(
  venueId: string,
  useCache = true
): Promise<InventorySummary> {
  const supabase = await createClient();

  // Check cache
  if (useCache) {
    const cached = await getCachedContext(venueId, "inventory_summary");
    if (cached) return cached as InventorySummary;
  }

  // Get all ingredients with stock levels
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("id, name, on_hand, reorder_level, par_level, unit, cost_per_unit")
    .eq("venue_id", venueId)
    .eq("is_active", true);

  if (!ingredients || ingredients.length === 0) {
    return {
      totalIngredients: 0,
      lowStock: [],
      outOfStock: [],
      totalValue: 0,
      reorderNeeded: false,
    };
  }

  // Find low stock items (below reorder level)
  const lowStock = ingredients
    .filter((i) => i.on_hand <= i.reorder_level && i.on_hand > 0)
    .map((i) => ({
      id: i.id,
      name: i.name,
      onHand: i.on_hand,
      reorderLevel: i.reorder_level,
      unit: i.unit,
    }));

  // Find out of stock items
  const outOfStock = ingredients.filter((i) => i.on_hand <= 0).map((i) => i.name);

  // Calculate total inventory value
  const totalValue = ingredients.reduce((sum, i) => sum + i.on_hand * i.cost_per_unit, 0);

  const summary: InventorySummary = {
    totalIngredients: ingredients.length,
    lowStock,
    outOfStock,
    totalValue: Number(totalValue.toFixed(2)),
    reorderNeeded: lowStock.length > 0,
  };

  await cacheContext(venueId, "inventory_summary", summary as unknown as Record<string, unknown>);

  return summary;
}

// ============================================================================
// Orders Summary Builder
// ============================================================================

export async function getOrdersSummary(venueId: string, useCache = true): Promise<OrdersSummary> {
  const supabase = await createClient();

  // Check cache
  if (useCache) {
    const cached = await getCachedContext(venueId, "orders_summary");
    if (cached) return cached as OrdersSummary;
  }

  // Get live orders (not completed or cancelled)
  const { data: liveOrders } = await supabase
    .from("orders")
    .select("id, order_status, created_at")
    .eq("venue_id", venueId)
    .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

  // Get KDS tickets if enabled
  const { data: kdsTickets } = await supabase
    .from("kds_tickets")
    .select(
      `
      id,
      order_id,
      station_name,
      items,
      created_at,
      status,
      started_at,
      completed_at
    `
    )
    .eq("venue_id", venueId)
    .in("status", ["pending", "in_progress"]);

  interface KDSTicket {
    id: string;
    order_id: string;
    station_name: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    items: Array<{ name: string }>;
  }

  // Find overdue tickets (> 10 minutes in progress)
  const now = new Date();
  const overdueTickets =
    kdsTickets
      ?.filter((ticket: unknown) => {
        const t = ticket as KDSTicket;
        if (t.status !== "in_progress" || !t.started_at) return false;
        const startedAt = new Date(t.started_at);
        const minutesElapsed = (now.getTime() - startedAt.getTime()) / 1000 / 60;
        return minutesElapsed > 10;
      })
      .map((ticket: unknown) => {
        const t = ticket as KDSTicket;
        const startedAt = new Date(t.started_at!);
        const minutesOverdue = (now.getTime() - startedAt.getTime()) / 1000 / 60 - 10;
        return {
          id: t.id,
          orderId: t.order_id,
          station: t.station_name,
          items: t.items.map((i) => i.name),
          minutesOverdue: Math.round(minutesOverdue),
        };
      }) || [];

  // Calculate average prep time by station (last 24 hours)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const { data: completedTickets } = await supabase
    .from("kds_tickets")
    .select("station_name, started_at, completed_at")
    .eq("venue_id", venueId)
    .eq("status", "completed")
    .gte("created_at", oneDayAgo.toISOString())
    .not("started_at", "is", null)
    .not("completed_at", "is", null);

  // Group by station and calculate avg wait time
  const stationStats = new Map<string, { totalTime: number; count: number }>();

  completedTickets?.forEach((ticket: unknown) => {
    const t = ticket as KDSTicket;
    if (!t.started_at || !t.completed_at) return;
    const startedAt = new Date(t.started_at);
    const completedAt = new Date(t.completed_at);
    const prepTime = (completedAt.getTime() - startedAt.getTime()) / 1000 / 60;

    const existing = stationStats.get(t.station_name) || {
      totalTime: 0,
      count: 0,
    };
    stationStats.set(t.station_name, {
      totalTime: existing.totalTime + prepTime,
      count: existing.count + 1,
    });
  });

  const bottlenecks = Array.from(stationStats.entries())
    .map(([station, stats]) => ({
      station,
      avgWaitTime: Number((stats.totalTime / stats.count).toFixed(1)),
      ticketCount: stats.count,
    }))
    .sort((a, b) => b.avgWaitTime - a.avgWaitTime)
    .slice(0, 5);

  // Calculate overall avg prep time
  const totalPrepTime = Array.from(stationStats.values()).reduce((sum, s) => sum + s.totalTime, 0);
  const totalTickets = Array.from(stationStats.values()).reduce((sum, s) => sum + s.count, 0);
  const avgPrepTime = totalTickets > 0 ? Number((totalPrepTime / totalTickets).toFixed(1)) : 0;

  const summary: OrdersSummary = {
    liveOrders: liveOrders?.length || 0,
    overdueTickets,
    avgPrepTime,
    bottlenecks,
  };

  await cacheContext(venueId, "orders_summary", summary as unknown as Record<string, unknown>);

  return summary;
}

// ============================================================================
// Analytics Summary Builder
// ============================================================================

export async function getAnalyticsSummary(
  venueId: string,
  useCache = true
): Promise<AnalyticsSummary> {
  const supabase = await createClient();

  // Check cache
  if (useCache) {
    const cached = await getCachedContext(venueId, "analytics_summary");
    if (cached) return cached as AnalyticsSummary;
  }

  const now = new Date();

  // ========== TIME RANGES ==========
  // Today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // This week (Monday to today)
  const thisWeekStart = new Date(now);
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 is Sunday
  thisWeekStart.setDate(now.getDate() - daysFromMonday);
  thisWeekStart.setHours(0, 0, 0, 0);

  // This month (1st of month to today)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  // Last 7 days
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  // Last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Previous 7 days (for growth comparison)
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);

  // ========== FETCH ALL ORDERS (30 days) ==========
  const { data: allOrders } = await supabase
    .from("orders")
    .select("id, total_amount, created_at, items, payment_method, table_number, order_type")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  interface OrderWithDetails {
    id: string;
    total_amount: number;
    created_at: string;
    payment_method?: string;
    table_number?: number;
    order_type?: string;
    items: Array<{
      item_name?: string;
      quantity?: number;
      price?: number;
      category?: string;
    }>;
  }

  const orders = (allOrders || []) as unknown as OrderWithDetails[];

  // ========== GET MENU ITEMS ==========
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, category")
    .eq("venue_id", venueId)
    .eq("is_available", true);

  // ========== FILTER ORDERS BY TIME PERIOD ==========
  const todayOrders = orders.filter((o) => new Date(o.created_at) >= todayStart);
  const thisWeekOrders = orders.filter((o) => new Date(o.created_at) >= thisWeekStart);
  const thisMonthOrders = orders.filter((o) => new Date(o.created_at) >= thisMonthStart);
  const last7DaysOrders = orders.filter((o) => new Date(o.created_at) >= sevenDaysAgo);
  const last30DaysOrders = orders;
  const previous7DaysOrders = orders.filter(
    (o) => new Date(o.created_at) >= fourteenDaysAgo && new Date(o.created_at) < sevenDaysAgo
  );

  // ========== CALCULATE METRICS ==========
  const calculatePeriodMetrics = (periodOrders: OrderWithDetails[]) => {
    const revenue = periodOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const orderCount = periodOrders.length;
    const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
    return { revenue, orders: orderCount, avgOrderValue };
  };

  const todayMetrics = calculatePeriodMetrics(todayOrders);
  const thisWeekMetrics = calculatePeriodMetrics(thisWeekOrders);
  const thisMonthMetrics = calculatePeriodMetrics(thisMonthOrders);
  const last7DaysMetrics = calculatePeriodMetrics(last7DaysOrders);
  const last30DaysMetrics = calculatePeriodMetrics(last30DaysOrders);
  const previous7DaysMetrics = calculatePeriodMetrics(previous7DaysOrders);

  // Growth calculations
  const revenueGrowth =
    previous7DaysMetrics.revenue > 0
      ? ((last7DaysMetrics.revenue - previous7DaysMetrics.revenue) / previous7DaysMetrics.revenue) *
        100
      : 0;
  const ordersGrowth =
    previous7DaysMetrics.orders > 0
      ? ((last7DaysMetrics.orders - previous7DaysMetrics.orders) / previous7DaysMetrics.orders) *
        100
      : 0;

  // ========== ITEM PERFORMANCE ==========
  const itemStats = new Map<
    string,
    { name: string; count: number; revenue: number; category?: string }
  >();

  last7DaysOrders.forEach((order) => {
    if (!order.items || !Array.isArray(order.items)) return;
    order.items.forEach((item) => {
      const name = item.item_name || "Unknown";
      const quantity = item.quantity || 0;
      const price = item.price || 0;
      const revenue = quantity * price;
      const category = item.category;

      const existing = itemStats.get(name) || { name, count: 0, revenue: 0, category };
      itemStats.set(name, {
        name,
        count: existing.count + quantity,
        revenue: existing.revenue + revenue,
        category: category || existing.category,
      });
    });
  });

  const topItemsByCount = Array.from(itemStats.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topItemsByRevenue = Array.from(itemStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((item) => ({
      name: item.name,
      revenue: Number(item.revenue.toFixed(2)),
      count: item.count,
    }));

  // Never ordered items
  const orderedItemNames = new Set(Array.from(itemStats.keys()));
  const neverOrdered = (menuItems || [])
    .filter((item) => !orderedItemNames.has(item.name))
    .map((item) => item.name);

  // Rarely ordered items (1-2 orders in last 7 days)
  const rarelyOrdered = Array.from(itemStats.values())
    .filter((item) => item.count <= 2)
    .sort((a, b) => a.count - b.count)
    .slice(0, 10)
    .map((item) => ({ name: item.name, count: item.count }));

  // ========== CATEGORY PERFORMANCE ==========
  const categoryStats = new Map<
    string,
    { revenue: number; orders: Set<string>; itemCount: number }
  >();

  last7DaysOrders.forEach((order) => {
    if (!order.items || !Array.isArray(order.items)) return;
    order.items.forEach((item) => {
      const category = item.category || "Uncategorized";
      const quantity = item.quantity || 0;
      const price = item.price || 0;
      const revenue = quantity * price;

      const existing = categoryStats.get(category) || {
        revenue: 0,
        orders: new Set<string>(),
        itemCount: 0,
      };
      existing.revenue += revenue;
      existing.orders.add(order.id);
      categoryStats.set(category, existing);
    });
  });

  // Count items per category from menu
  const categoryItemCounts = new Map<string, number>();
  (menuItems || []).forEach((item) => {
    const category = item.category || "Uncategorized";
    categoryItemCounts.set(category, (categoryItemCounts.get(category) || 0) + 1);
  });

  const categoryPerformance: Record<
    string,
    { revenue: number; orders: number; itemCount: number }
  > = {};
  categoryStats.forEach((stats, category) => {
    categoryPerformance[category] = {
      revenue: Number(stats.revenue.toFixed(2)),
      orders: stats.orders.size,
      itemCount: categoryItemCounts.get(category) || 0,
    };
  });

  // ========== TIME ANALYSIS ==========
  // By day of week
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayStats = new Map<number, { revenue: number; orders: number }>();

  last30DaysOrders.forEach((order) => {
    const day = new Date(order.created_at).getDay();
    const existing = dayStats.get(day) || { revenue: 0, orders: 0 };
    existing.revenue += order.total_amount || 0;
    existing.orders += 1;
    dayStats.set(day, existing);
  });

  const byDayOfWeek = Array.from({ length: 7 }, (_, i) => {
    const stats = dayStats.get(i) || { revenue: 0, orders: 0 };
    return {
      day: dayNames[i],
      revenue: Number(stats.revenue.toFixed(2)),
      orders: stats.orders,
      avgOrderValue: stats.orders > 0 ? Number((stats.revenue / stats.orders).toFixed(2)) : 0,
    };
  });

  // Find busiest day
  const busiestDayIndex = byDayOfWeek.reduce(
    (maxIdx, day, idx, arr) => (day.orders > arr[maxIdx].orders ? idx : maxIdx),
    0
  );
  const busiestDay = dayNames[busiestDayIndex];

  // By hour
  const hourStats = new Map<number, { revenue: number; orders: number }>();

  last30DaysOrders.forEach((order) => {
    const hour = new Date(order.created_at).getHours();
    const existing = hourStats.get(hour) || { revenue: 0, orders: 0 };
    existing.revenue += order.total_amount || 0;
    existing.orders += 1;
    hourStats.set(hour, existing);
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const stats = hourStats.get(hour) || { revenue: 0, orders: 0 };
    return {
      hour,
      revenue: Number(stats.revenue.toFixed(2)),
      orders: stats.orders,
    };
  });

  // Peak hours (top 5)
  const peakHours = Array.from(hourStats.entries())
    .sort((a, b) => b[1].orders - a[1].orders)
    .slice(0, 5)
    .map(([hour, stats]) => ({ hour, orderCount: stats.orders }));

  // ========== PAYMENT METHODS ==========
  const paymentStats = new Map<string, { count: number; revenue: number }>();

  last30DaysOrders.forEach((order) => {
    const method = order.payment_method || "Unknown";
    const existing = paymentStats.get(method) || { count: 0, revenue: 0 };
    existing.count += 1;
    existing.revenue += order.total_amount || 0;
    paymentStats.set(method, existing);
  });

  const paymentMethods: Record<string, { count: number; revenue: number }> = {};
  paymentStats.forEach((stats, method) => {
    paymentMethods[method] = {
      count: stats.count,
      revenue: Number(stats.revenue.toFixed(2)),
    };
  });

  // ========== ORDER PATTERNS ==========
  let totalItemsInOrders = 0;
  let takeawayCount = 0;
  let dineInCount = 0;

  last30DaysOrders.forEach((order) => {
    if (order.items && Array.isArray(order.items)) {
      totalItemsInOrders += order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }
    if (order.order_type === "takeaway" || order.table_number === null) {
      takeawayCount += 1;
    } else {
      dineInCount += 1;
    }
  });

  const avgItemsPerOrder =
    last30DaysOrders.length > 0 ? totalItemsInOrders / last30DaysOrders.length : 0;

  // ========== TABLE METRICS (if applicable) ==========
  const { data: tableSessions } = await supabase
    .from("table_sessions")
    .select("table_number, started_at, ended_at, total_amount")
    .eq("venue_id", venueId)
    .gte("started_at", thirtyDaysAgo.toISOString())
    .not("session_status", "eq", "CANCELLED");

  let tableMetrics;
  if (tableSessions && tableSessions.length > 0) {
    const tableStats = new Map<number, { revenue: number; sessions: number; totalTime: number }>();
    let totalTurnoverTime = 0;
    let sessionsWithEndTime = 0;

    tableSessions.forEach((session: Record<string, unknown>) => {
      const tableNumber = session.table_number as number;
      const startedAt = session.started_at as string;
      const endedAt = session.ended_at as string | null;
      const totalAmount = (session.total_amount as number) || 0;

      const existing = tableStats.get(tableNumber) || { revenue: 0, sessions: 0, totalTime: 0 };
      existing.revenue += totalAmount;
      existing.sessions += 1;

      if (endedAt) {
        const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
        existing.totalTime += duration;
        totalTurnoverTime += duration;
        sessionsWithEndTime += 1;
      }

      tableStats.set(tableNumber, existing);
    });

    const avgTurnoverTime =
      sessionsWithEndTime > 0 ? totalTurnoverTime / sessionsWithEndTime / 60000 : 0; // in minutes

    const revenueByTable = Array.from(tableStats.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([tableNumber, stats]) => ({
        tableNumber,
        revenue: Number(stats.revenue.toFixed(2)),
        sessions: stats.sessions,
      }));

    tableMetrics = {
      avgTurnoverTime: Number(avgTurnoverTime.toFixed(2)),
      totalSessions: tableSessions.length,
      revenueByTable,
    };
  }

  // ========== BUILD SUMMARY ==========
  const summary: AnalyticsSummary = {
    today: {
      revenue: Number(todayMetrics.revenue.toFixed(2)),
      orders: todayMetrics.orders,
      avgOrderValue: Number(todayMetrics.avgOrderValue.toFixed(2)),
    },
    last7Days: {
      revenue: Number(last7DaysMetrics.revenue.toFixed(2)),
      orders: last7DaysMetrics.orders,
      avgOrderValue: Number(last7DaysMetrics.avgOrderValue.toFixed(2)),
    },
    last30Days: {
      revenue: Number(last30DaysMetrics.revenue.toFixed(2)),
      orders: last30DaysMetrics.orders,
      avgOrderValue: Number(last30DaysMetrics.avgOrderValue.toFixed(2)),
    },
    thisWeek: {
      revenue: Number(thisWeekMetrics.revenue.toFixed(2)),
      orders: thisWeekMetrics.orders,
      avgOrderValue: Number(thisWeekMetrics.avgOrderValue.toFixed(2)),
    },
    thisMonth: {
      revenue: Number(thisMonthMetrics.revenue.toFixed(2)),
      orders: thisMonthMetrics.orders,
      avgOrderValue: Number(thisMonthMetrics.avgOrderValue.toFixed(2)),
    },
    trending: {
      topItems: topItemsByCount.slice(0, 5).map((item) => ({
        name: item.name,
        count: item.count,
        revenue: Number(item.revenue.toFixed(2)),
      })),
      categoryPerformance,
    },
    growth: {
      revenueGrowth: Number(revenueGrowth.toFixed(2)),
      ordersGrowth: Number(ordersGrowth.toFixed(2)),
    },
    timeAnalysis: {
      byDayOfWeek,
      byHour,
      peakHours,
      busiestDay,
    },
    paymentMethods,
    orderPatterns: {
      avgItemsPerOrder: Number(avgItemsPerOrder.toFixed(2)),
      takeawayVsDineIn: { takeaway: takeawayCount, dineIn: dineInCount },
    },
    itemPerformance: {
      neverOrdered: neverOrdered.slice(0, 20),
      rarelyOrdered,
      topByRevenue,
    },
    ...(tableMetrics && { tableMetrics }),
  };

  await cacheContext(venueId, "analytics_summary", summary as unknown as Record<string, unknown>);

  return summary;
}

// ============================================================================
// Cache Helpers
// ============================================================================

async function getCachedContext(venueId: string, contextType: string): Promise<unknown | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("ai_context_cache")
    .select("context_data, expires_at")
    .eq("venue_id", venueId)
    .eq("context_type", contextType)
    .single();

  if (!data) return null;

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data.context_data;
}

async function cacheContext(
  venueId: string,
  contextType: string,
  contextData: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + CACHE_TTL);

  await supabase.from("ai_context_cache").upsert(
    {
      venue_id: venueId,
      context_type: contextType,
      context_data: contextData,
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: "venue_id,context_type" }
  );
}

// ============================================================================
// Get All Summaries Helper
// ============================================================================

interface Features {
  inventoryEnabled?: boolean;
  kdsEnabled?: boolean;
}

interface AllSummaries {
  menu: MenuSummary;
  analytics: AnalyticsSummary;
  inventory?: InventorySummary;
  orders?: OrdersSummary;
}

export async function getAllSummaries(venueId: string, features: Features): Promise<AllSummaries> {
  const summaries: AllSummaries = {
    menu: await getMenuSummary(venueId),
    analytics: await getAnalyticsSummary(venueId),
  };

  if (features.inventoryEnabled) {
    summaries.inventory = await getInventorySummary(venueId);
  }

  if (features.kdsEnabled) {
    summaries.orders = await getOrdersSummary(venueId);
  }

  return summaries;
}
