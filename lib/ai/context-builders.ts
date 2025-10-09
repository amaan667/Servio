// Servio AI Assistant - Context Builders (RAG Layer)
// Gathers and summarizes data for LLM planning

import { createClient } from "@/lib/supabase/server";
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
    } catch (error) {
      // Table doesn't exist or other error - use default
      console.log("[AI ASSISTANT] Could not get user role:", error);
    }
  }

  // Get venue details
  const { data: venueData } = await supabase
    .from("venues")
    .select("tier, timezone, kds_enabled, inventory_enabled")
    .eq("venue_id", venueId)
    .single();

  return {
    venueId,
    userId,
    userRole,
    venueTier: venueData?.tier || "starter",
    timezone: venueData?.timezone || "UTC",
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

export async function getMenuSummary(
  venueId: string,
  useCache = true
): Promise<MenuSummary> {
  const supabase = await createClient();

  // Check cache first
  if (useCache) {
    const cached = await getCachedContext(venueId, "menu_summary");
    if (cached) return cached as MenuSummary;
  }

  // Get total items and categories
  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, price, category_id, categories(id, name)")
    .eq("venue_id", venueId)
    .eq("available", true);

  if (!items || items.length === 0) {
    return {
      totalItems: 0,
      categories: [],
      topSellers: [],
      avgPrice: 0,
      priceRange: { min: 0, max: 0 },
    };
  }

  // Get sales data for last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: orderItems } = await supabase
    .from("order_items")
    .select(
      `
      menu_item_id,
      quantity,
      price,
      orders!inner(created_at, venue_id)
    `
    )
    .eq("orders.venue_id", venueId)
    .gte("orders.created_at", sevenDaysAgo.toISOString());

  // Calculate sales per item
  const salesMap = new Map<
    string,
    { sales: number; revenue: number; name: string; price: number }
  >();

  orderItems?.forEach((oi: any) => {
    const existing = salesMap.get(oi.menu_item_id) || {
      sales: 0,
      revenue: 0,
      name: "",
      price: 0,
    };
    salesMap.set(oi.menu_item_id, {
      sales: existing.sales + oi.quantity,
      revenue: existing.revenue + oi.price * oi.quantity,
      name: items.find((i) => i.id === oi.menu_item_id)?.name || "",
      price: items.find((i) => i.id === oi.menu_item_id)?.price || 0,
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
  const categoryMap = new Map<string, { id: string; name: string; count: number }>();
  items.forEach((item: any) => {
    if (item.categories) {
      const existing = categoryMap.get(item.category_id) || {
        id: item.category_id,
        name: item.categories.name,
        count: 0,
      };
      categoryMap.set(item.category_id, {
        ...existing,
        count: existing.count + 1,
      });
    }
  });

  const categories = Array.from(categoryMap.values()).map((cat) => ({
    id: cat.id,
    name: cat.name,
    itemCount: cat.count,
  }));

  // Calculate price stats
  const prices = items.map((i) => i.price);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const summary: MenuSummary = {
    totalItems: items.length,
    categories,
    topSellers,
    avgPrice: Number(avgPrice.toFixed(2)),
    priceRange: { min: minPrice, max: maxPrice },
  };

  // Cache for 1 minute
  await cacheContext(venueId, "menu_summary", summary);

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
  const outOfStock = ingredients
    .filter((i) => i.on_hand <= 0)
    .map((i) => i.name);

  // Calculate total inventory value
  const totalValue = ingredients.reduce(
    (sum, i) => sum + i.on_hand * i.cost_per_unit,
    0
  );

  const summary: InventorySummary = {
    totalIngredients: ingredients.length,
    lowStock,
    outOfStock,
    totalValue: Number(totalValue.toFixed(2)),
    reorderNeeded: lowStock.length > 0,
  };

  await cacheContext(venueId, "inventory_summary", summary);

  return summary;
}

// ============================================================================
// Orders Summary Builder
// ============================================================================

export async function getOrdersSummary(
  venueId: string,
  useCache = true
): Promise<OrdersSummary> {
  const supabase = await createClient();

  // Check cache
  if (useCache) {
    const cached = await getCachedContext(venueId, "orders_summary");
    if (cached) return cached as OrdersSummary;
  }

  // Get live orders (not completed or cancelled)
  const { data: liveOrders } = await supabase
    .from("orders")
    .select("id, status, created_at")
    .eq("venue_id", venueId)
    .in("status", ["pending", "preparing", "ready"]);

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

  // Find overdue tickets (> 10 minutes in progress)
  const now = new Date();
  const overdueTickets =
    kdsTickets
      ?.filter((ticket: any) => {
        if (ticket.status !== "in_progress" || !ticket.started_at) return false;
        const startedAt = new Date(ticket.started_at);
        const minutesElapsed = (now.getTime() - startedAt.getTime()) / 1000 / 60;
        return minutesElapsed > 10;
      })
      .map((ticket: any) => {
        const startedAt = new Date(ticket.started_at);
        const minutesOverdue =
          (now.getTime() - startedAt.getTime()) / 1000 / 60 - 10;
        return {
          id: ticket.id,
          orderId: ticket.order_id,
          station: ticket.station_name,
          items: ticket.items.map((i: any) => i.name),
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
  const stationStats = new Map<
    string,
    { totalTime: number; count: number }
  >();

  completedTickets?.forEach((ticket: any) => {
    const startedAt = new Date(ticket.started_at);
    const completedAt = new Date(ticket.completed_at);
    const prepTime = (completedAt.getTime() - startedAt.getTime()) / 1000 / 60;

    const existing = stationStats.get(ticket.station_name) || {
      totalTime: 0,
      count: 0,
    };
    stationStats.set(ticket.station_name, {
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
  const totalPrepTime = Array.from(stationStats.values()).reduce(
    (sum, s) => sum + s.totalTime,
    0
  );
  const totalTickets = Array.from(stationStats.values()).reduce(
    (sum, s) => sum + s.count,
    0
  );
  const avgPrepTime =
    totalTickets > 0 ? Number((totalPrepTime / totalTickets).toFixed(1)) : 0;

  const summary: OrdersSummary = {
    liveOrders: liveOrders?.length || 0,
    overdueTickets,
    avgPrepTime,
    bottlenecks,
  };

  await cacheContext(venueId, "orders_summary", summary);

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

  // Get today's data
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayOrders } = await supabase
    .from("orders")
    .select("id, total_amount, order_items(quantity, price, menu_items(name, category_id, categories(name)))")
    .eq("venue_id", venueId)
    .gte("created_at", todayStart.toISOString())
    .in("status", ["completed", "preparing", "ready"]);

  const todayRevenue = todayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const todayOrderCount = todayOrders?.length || 0;
  const avgOrderValue = todayOrderCount > 0 ? todayRevenue / todayOrderCount : 0;

  // Get trending items (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentItems } = await supabase
    .from("order_items")
    .select("menu_item_id, quantity, menu_items(name, category_id, categories(name))")
    .eq("orders.venue_id", venueId)
    .gte("orders.created_at", sevenDaysAgo.toISOString());

  // Count by item
  const itemCounts = new Map<string, { name: string; count: number }>();
  recentItems?.forEach((item: any) => {
    const name = item.menu_items?.name || "Unknown";
    const existing = itemCounts.get(name) || { name, count: 0 };
    itemCounts.set(name, { name, count: existing.count + item.quantity });
  });

  const topItems = Array.from(itemCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((i) => i.name);

  // Count by category
  const categoryPerformance: Record<string, number> = {};
  recentItems?.forEach((item: any) => {
    const categoryName = item.menu_items?.categories?.name || "Uncategorized";
    categoryPerformance[categoryName] = (categoryPerformance[categoryName] || 0) + item.quantity;
  });

  const summary: AnalyticsSummary = {
    today: {
      revenue: Number(todayRevenue.toFixed(2)),
      orders: todayOrderCount,
      avgOrderValue: Number(avgOrderValue.toFixed(2)),
    },
    trending: {
      topItems,
      categoryPerformance,
    },
  };

  await cacheContext(venueId, "analytics_summary", summary);

  return summary;
}

// ============================================================================
// Cache Helpers
// ============================================================================

async function getCachedContext(
  venueId: string,
  contextType: string
): Promise<any | null> {
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
  contextData: any
): Promise<void> {
  const supabase = await createClient();

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + CACHE_TTL);

  await supabase
    .from("ai_context_cache")
    .upsert(
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

export async function getAllSummaries(venueId: string, features: any) {
  const summaries: any = {
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

