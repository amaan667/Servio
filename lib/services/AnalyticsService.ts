/**
 * Analytics Service
 * Provides comprehensive analytics data retrieval and aggregation
 */

import { createClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import {
  DateRange,
  AnalyticsFilters,
  RevenueAnalytics,
  OrderAnalytics,
  CustomerAnalytics,
  InventoryAnalytics,
  StaffPerformanceAnalytics,
  DashboardMetrics,
  RevenueDataPoint,
  ReportConfiguration,
  GeneratedReport,
} from "@/lib/analytics/types";

export class AnalyticsService {
  private static readonly CACHE_TTL = 300; // 5 minutes

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Get cache key for analytics data
   */
  private static getCacheKey(operation: string, venueId: string, filters: AnalyticsFilters): string {
    const dateRangeKey = `${filters.dateRange.start.toISOString()}-${filters.dateRange.end.toISOString()}`;
    return `analytics:${operation}:${venueId}:${dateRangeKey}`;
  }

  /**
   * Get Supabase client (server-side)
   */
  private static async getSupabase() {
    return createClient();
  }

  /**
   * Calculate previous period dates
   */
  private static getPreviousPeriod(dateRange: DateRange): DateRange {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const periodLength = end.getTime() - start.getTime();
    
    const previousStart = new Date(start.getTime() - periodLength - 86400000); // Add 1 day gap
    const previousEnd = new Date(start.getTime() - 86400000); // Day before current period
    
    return {
      start: previousStart,
      end: previousEnd,
    };
  }

  // ========================================
  // REVENUE ANALYTICS
  // ========================================

  /**
   * Get revenue analytics for a venue
   */
  static async getRevenueAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<RevenueAnalytics> {
    const cacheKey = this.getCacheKey("revenue", venueId, filters);
    
    return this.withCache(cacheKey, () => this.computeRevenueAnalytics(venueId, filters));
  }

  private static async computeRevenueAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<RevenueAnalytics> {
    const supabase = await this.getSupabase();
    const { start, end } = filters.dateRange;

    // Get orders in date range
    const { data: orders, error } = await supabase
      .from("orders")
      .select("total_amount, created_at, payment_status")
      .eq("venue_id", venueId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) throw error;

    // Calculate basic metrics
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const totalOrders = orders?.length || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get previous period data
    const previousPeriod = this.getPreviousPeriod(filters.dateRange);
    const { data: previousOrders } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("venue_id", venueId)
      .gte("created_at", previousPeriod.start.toISOString())
      .lte("created_at", previousPeriod.end.toISOString());

    const previousRevenue = previousOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const revenueGrowth = previousRevenue > 0 
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
      : 0;
    const orderGrowth = previousOrders?.length 
      ? ((totalOrders - previousOrders.length) / previousOrders.length) * 100 
      : 0;

    // Get daily breakdown
    const dailyBreakdown = await this.getDailyRevenueBreakdown(supabase, venueId, filters.dateRange);

    // Get weekly comparison
    const weeklyComparison = await this.getWeeklyComparison(supabase, venueId, filters.dateRange);

    // Get monthly trend
    const monthlyTrend = await this.getMonthlyTrend(supabase, venueId, filters.dateRange);

    // Period over period
    const periodOverPeriod = {
      current: totalRevenue,
      previous: previousRevenue,
      change: totalRevenue - previousRevenue,
      changePercent: revenueGrowth,
    };

    // Year over year (simplified)
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const { data: currentYearOrders } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("venue_id", venueId)
      .gte("created_at", yearStart.toISOString());

    const { data: lastYearOrders } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("venue_id", venueId)
      .gte("created_at", new Date(new Date().getFullYear() - 1, 0, 1).toISOString())
      .lt("created_at", yearStart.toISOString());

    const currentYearRevenue = currentYearOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const lastYearRevenue = lastYearOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      revenueGrowth,
      orderGrowth,
      dailyBreakdown,
      weeklyComparison,
      monthlyTrend,
      periodOverPeriod,
      yearOverYear: {
        currentYear: currentYearRevenue,
        lastYear: lastYearRevenue,
        change: currentYearRevenue - lastYearRevenue,
        changePercent: lastYearRevenue > 0 
          ? ((currentYearRevenue - lastYearRevenue) / lastYearRevenue) * 100 
          : 0,
      },
    };
  }

  private static async getDailyRevenueBreakdown(
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
    dateRange: DateRange
  ): Promise<RevenueDataPoint[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Group by day
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    
    data?.forEach((order) => {
      const day = new Date(order.created_at).toISOString().split("T")[0] || "";
      const existing = dayMap.get(day) || { revenue: 0, orders: 0 };
      dayMap.set(day, {
        revenue: existing.revenue + (order.total_amount || 0),
        orders: existing.orders + 1,
      });
    });

    return Array.from(dayMap.entries()).map(([date, stats]) => ({
      date,
      revenue: stats.revenue,
      orders: stats.orders,
      averageOrderValue: stats.orders > 0 ? stats.revenue / stats.orders : 0,
    }));
  }

  private static async getWeeklyComparison(
    supabase: Awaited<ReturnType<typeof createClient>>,
    _venueId: string,
    _dateRange: DateRange
  ): Promise<RevenueDataPoint[]> {
    // Simplified: return last 7 days
    return this.getDailyRevenueBreakdown(
      supabase,
      "", // venueId is not used in this simplified version
      {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      }
    );
  }

  private static async getMonthlyTrend(
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
    dateRange: DateRange
  ): Promise<RevenueDataPoint[]> {
    const { data, error } = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());

    if (error) throw error;

    // Group by week
    const weekMap = new Map<string, { revenue: number; orders: number }>();
    
    data?.forEach((order) => {
      const date = new Date(order.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split("T")[0] || "";
      
      const existing = weekMap.get(weekKey) || { revenue: 0, orders: 0 };
      weekMap.set(weekKey, {
        revenue: existing.revenue + (order.total_amount || 0),
        orders: existing.orders + 1,
      });
    });

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        revenue: stats.revenue,
        orders: stats.orders,
        averageOrderValue: stats.orders > 0 ? stats.revenue / stats.orders : 0,
      }));
  }

  // ========================================
  // ORDER ANALYTICS
  // ========================================

  /**
   * Get order analytics for a venue
   */
  static async getOrderAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<OrderAnalytics> {
    const cacheKey = this.getCacheKey("orders", venueId, filters);
    
    return this.withCache(cacheKey, () => this.computeOrderAnalytics(venueId, filters));
  }

  private static async computeOrderAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<OrderAnalytics> {
    const supabase = await this.getSupabase();
    const { start, end } = filters.dateRange;

    const { data: orders, error } = await supabase
      .from("orders")
      .select("total_amount, created_at, status, order_type, updated_at")
      .eq("venue_id", venueId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) throw error;

    // Basic metrics
    const totalOrders = orders?.length || 0;
    const completedOrders = orders?.filter(o => 
      ["served", "completed"].includes(o.status)
    ).length || 0;
    const cancelledOrders = orders?.filter(o => 
      o.status === "cancelled"
    ).length || 0;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Average order time
    const completedWithTime = orders?.filter(o => 
      o.updated_at && o.created_at && ["served", "completed"].includes(o.status)
    ) || [];
    const averageOrderTime = completedWithTime.length > 0
      ? completedWithTime.reduce((sum, o) => {
          const created = new Date(o.created_at).getTime();
          const updated = new Date(o.updated_at).getTime();
          return sum + (updated - created);
        }, 0) / completedWithTime.length / 60000 // Convert to minutes
      : 0;

    // Order volume by hour
    const hourlyMap = new Map<number, { count: number; revenue: number }>();
    orders?.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      const existing = hourlyMap.get(hour) || { count: 0, revenue: 0 };
      hourlyMap.set(hour, {
        count: existing.count + 1,
        revenue: existing.revenue + (order.total_amount || 0),
      });
    });

    const orderVolumeByHour = Array.from(hourlyMap.entries()).map(([hour, stats]) => ({
      hour,
      count: stats.count,
      revenue: stats.revenue,
    }));

    // Peak hours (top 5)
    const peakHours = orderVolumeByHour
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(h => ({ hour: h.hour, orderCount: h.count, revenue: h.revenue }));

    // Order type distribution
    const typeMap = new Map<string, { count: number; revenue: number }>();
    orders?.forEach((order) => {
      const type = order.order_type || "dine_in";
      const existing = typeMap.get(type) || { count: 0, revenue: 0 };
      typeMap.set(type, {
        count: existing.count + 1,
        revenue: existing.revenue + (order.total_amount || 0),
      });
    });

    const orderTypeDistribution = Array.from(typeMap.entries()).map(([type, stats]) => ({
      type: type as "dine_in" | "takeaway" | "delivery",
      count: stats.count,
      revenue: stats.revenue,
      percentage: totalOrders > 0 ? (stats.count / totalOrders) * 100 : 0,
    }));

    // Order status breakdown
    const statusMap = new Map<string, number>();
    orders?.forEach((order) => {
      statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
    });

    const orderStatusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: totalOrders > 0 ? (count / totalOrders) * 100 : 0,
    }));

    // Daily breakdown
    const dailyMap = new Map<string, { count: number; revenue: number }>();
    orders?.forEach((order) => {
      const day = new Date(order.created_at).toISOString().split("T")[0] || "";
      const existing = dailyMap.get(day) || { count: 0, revenue: 0 };
      dailyMap.set(day, {
        count: existing.count + 1,
        revenue: existing.revenue + (order.total_amount || 0),
      });
    });

    const orderVolumeByDay = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      count: stats.count,
      revenue: stats.revenue,
    }));

    return {
      totalOrders,
      completedOrders,
      cancelledOrders,
      averageOrderValue,
      averageOrderTime,
      orderVolumeByDay,
      orderVolumeByHour,
      orderTypeDistribution,
      peakHours,
      orderStatusBreakdown,
    };
  }

  // ========================================
  // CUSTOMER ANALYTICS
  // ========================================

  /**
   * Get customer analytics for a venue
   */
  static async getCustomerAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<CustomerAnalytics> {
    const cacheKey = this.getCacheKey("customers", venueId, filters);
    
    return this.withCache(cacheKey, () => this.computeCustomerAnalytics(venueId, filters));
  }

  private static async computeCustomerAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<CustomerAnalytics> {
    const supabase = await this.getSupabase();
    const { start, end } = filters.dateRange;

    const { data: orders, error } = await supabase
      .from("orders")
      .select("customer_name, customer_email, total_amount, created_at")
      .eq("venue_id", venueId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) throw error;

    // Get all customer orders for analysis
    const { data: allOrders } = await supabase
      .from("orders")
      .select("customer_name, customer_email, total_amount, created_at")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Analyze customers
    const customerMap = new Map<string, { 
      orders: number; 
      revenue: number; 
      firstOrder: string; 
      lastOrder: string;
    }>();

    allOrders?.forEach((order) => {
      const key = order.customer_name || `anonymous-${order.customer_email || "unknown"}` || "anonymous";
      const existing = customerMap.get(key) || {
        orders: 0,
        revenue: 0,
        firstOrder: order.created_at,
        lastOrder: order.created_at,
      };
      
      customerMap.set(key, {
        orders: existing.orders + 1,
        revenue: existing.revenue + (order.total_amount || 0),
        firstOrder: order.created_at < existing.firstOrder ? order.created_at : existing.firstOrder,
        lastOrder: order.created_at > existing.lastOrder ? order.created_at : existing.lastOrder,
      });
    });

    const customers = Array.from(customerMap.entries());
    const totalCustomers = customers.length;

    // New vs returning in period
    const newCustomers = customers.filter(([, data]) => 
      new Date(data.firstOrder) >= start && new Date(data.firstOrder) <= end
    ).length;
    const returningCustomers = totalCustomers - newCustomers;

    // Customer segments
    const segments = customers.map(([name, data]) => {
      if (data.orders === 1) return { segment: "new" as const, customer: name, ...data };
      if (data.orders >= 5) return { segment: "loyal" as const, customer: name, ...data };
      if (data.orders >= 2) return { segment: "returning" as const, customer: name, ...data };
      return { segment: "new" as const, customer: name, ...data };
    });

    const customerSegments = [
      { segment: "new" as const, count: segments.filter(s => s.segment === "new").length },
      { segment: "returning" as const, count: segments.filter(s => s.segment === "returning").length },
      { segment: "loyal" as const, count: segments.filter(s => s.segment === "loyal").length },
    ].map(s => ({
      ...s,
      percentage: totalCustomers > 0 ? (s.count / totalCustomers) * 100 : 0,
      revenue: segments
        .filter(seg => seg.segment === s.segment)
        .reduce((sum, seg) => sum + seg.revenue, 0),
    }));

    // Retention and repeat rates
    const repeatCustomers = customers.filter(c => c[1].orders > 1).length;
    const retentionRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
    const repeatPurchaseRate = totalCustomers > 0 
      ? (repeatCustomers / (customers.filter(c => c[1].orders >= 1).length)) * 100 
      : 0;
    const averageOrdersPerCustomer = totalCustomers > 0 
      ? allOrders?.length 
        ? allOrders.length / totalCustomers 
        : 0 
      : 0;

    // Customer lifetime value
    const totalCustomerRevenue = customers.reduce((sum, [, data]) => sum + data.revenue, 0);
    const averageLifetimeValue = totalCustomers > 0 
      ? totalCustomerRevenue / totalCustomers 
      : 0;

    // Top customers
    const topCustomers = customers
      .map(([name, data]) => ({
        customerId: name,
        customerName: name,
        totalRevenue: data.revenue,
        orderCount: data.orders,
        lastOrderDate: data.lastOrder,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      uniqueCustomers: totalCustomers,
      customerSegments,
      retentionRate,
      repeatPurchaseRate,
      averageOrdersPerCustomer,
      averageLifetimeValue,
      topCustomers,
      customerGrowth: {
        newCustomers,
        returnedCustomers: returningCustomers,
        growthRate: newCustomers > 0 ? (returningCustomers / newCustomers) * 100 : 0,
      },
    };
  }

  // ========================================
  // INVENTORY ANALYTICS
  // ========================================

  /**
   * Get inventory analytics for a venue
   */
  static async getInventoryAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<InventoryAnalytics> {
    const cacheKey = this.getCacheKey("inventory", venueId, filters);
    
    return this.withCache(cacheKey, () => this.computeInventoryAnalytics(venueId, filters));
  }

  private static async computeInventoryAnalytics(
    venueId: string,
    _filters: AnalyticsFilters
  ): Promise<InventoryAnalytics> {
    const supabase = await this.getSupabase();

    // Get ingredients
    const { data: ingredients, error: ingredientsError } = await supabase
      .from("ingredients")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true);

    if (ingredientsError) throw ingredientsError;

    // Get inventory logs
    const { data: logs, error: logsError } = await supabase
      .from("inventory_logs")
      .select("*")
      .eq("venue_id", venueId)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (logsError) throw logsError;

    // Calculate metrics
    const totalInventoryValue = ingredients?.reduce((sum, ing) => {
      return sum + (ing.quantity || 0) * (ing.cost_per_unit || 0);
    }, 0) || 0;

    const lowStockItems = ingredients?.filter(ing => 
      (ing.quantity || 0) <= (ing.min_quantity || 0)
    ).length || 0;

    const stockoutItems = ingredients?.filter(ing => 
      (ing.quantity || 0) === 0
    ).length || 0;

    // Usage by category
    const categoryMap = new Map<string, { quantity: number; cost: number }>();
    ingredients?.forEach(ing => {
      const cat = ing.category || "Uncategorized";
      const existing = categoryMap.get(cat) || { quantity: 0, cost: 0 };
      categoryMap.set(cat, {
        quantity: existing.quantity + (ing.quantity || 0),
        cost: existing.cost + ((ing.quantity || 0) * (ing.cost_per_unit || 0)),
      });
    });

    const usageByCategory = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      quantity: stats.quantity,
      cost: stats.cost,
      percentage: totalInventoryValue > 0 ? (stats.cost / totalInventoryValue) * 100 : 0,
    }));

    // Waste tracking
    const wasteLogs = logs?.filter(log => log.action === "remove") || [];
    const wasteByReason = Array.from(
      new Set(wasteLogs.map(l => l.reason || "Other"))
    ).map(reason => {
      const logsWithReason = wasteLogs.filter(l => (l.reason || "Other") === reason);
      const quantity = logsWithReason.reduce((sum, l) => sum + (l.quantity_change || 0), 0);
      const cost = logsWithReason.reduce((sum, l) => sum + Math.abs(l.quantity_change || 0) * 0, 0);
      return { reason, quantity, cost };
    });

    // Reorder items
    const reorderItems = ingredients
      ?.filter(ing => (ing.quantity || 0) <= (ing.min_quantity || 0))
      .map(ing => ({
        ingredientId: ing.id,
        name: ing.name,
        currentStock: ing.quantity || 0,
        reorderPoint: ing.min_quantity || 0,
        recommendedOrderQuantity: (ing.min_quantity || 0) * 2,
        estimatedCost: (ing.min_quantity || 0) * (ing.cost_per_unit || 0),
      }))
      .slice(0, 10);

    return {
      totalInventoryValue,
      inventoryTurnoverRate: 0, // Would need more historical data
      shrinkageRate: 0, // Would need shrinkage tracking
      stockoutItems,
      lowStockItems,
      usageByCategory,
      wasteByReason,
      reorderItems: reorderItems || [],
      costBreakdown: {
        totalCost: totalInventoryValue,
        foodCost: 0,
        beverageCost: 0,
        otherCost: 0,
        costAsPercentage: 0,
      },
    };
  }

  // ========================================
  // STAFF PERFORMANCE ANALYTICS
  // ========================================

  /**
   * Get staff performance analytics for a venue
   */
  static async getStaffPerformanceAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<StaffPerformanceAnalytics> {
    const cacheKey = this.getCacheKey("staff", venueId, filters);
    
    return this.withCache(cacheKey, () => this.computeStaffPerformanceAnalytics(venueId, filters));
  }

  private static async computeStaffPerformanceAnalytics(
    venueId: string,
    filters: AnalyticsFilters
  ): Promise<StaffPerformanceAnalytics> {
    const supabase = await this.getSupabase();
    const { start, end } = filters.dateRange;

    // Get staff
    const { data: staff, error: staffError } = await supabase
      .from("user_venue_roles")
      .select("user_id, role, profiles(full_name)")
      .eq("venue_id", venueId)
      .neq("role", "owner");

    if (staffError) throw staffError;

    // Get orders for period
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("assigned_to, total_amount, created_at, updated_at, status")
      .eq("venue_id", venueId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (ordersError) throw ordersError;

    // Calculate per-staff metrics
    const staffMap = new Map<string, {
      name: string;
      role: string;
      orders: number;
      revenue: number;
      totalTime: number;
      orderCount: number;
    }>();

    // Add staff to map
    staff?.forEach(s => {
      const fullName = (s.profiles as { full_name?: string } | null)?.full_name || "Unknown";
      staffMap.set(s.user_id, {
        name: fullName,
        role: s.role,
        orders: 0,
        revenue: 0,
        totalTime: 0,
        orderCount: 0,
      });
    });

    // Aggregate order data
    orders?.forEach(order => {
      if (order.assigned_to && staffMap.has(order.assigned_to)) {
        const existing = staffMap.get(order.assigned_to)!;
        existing.orders += 1;
        existing.revenue += order.total_amount || 0;
        
        if (["served", "completed"].includes(order.status)) {
          existing.orderCount += 1;
          const time = new Date(order.updated_at).getTime() - new Date(order.created_at).getTime();
          existing.totalTime += time;
        }
      }
    });

    const staffMembers = Array.from(staffMap.values())
      .map(s => ({
        staffId: "",
        name: s.name,
        role: s.role,
        ordersHandled: s.orders,
        revenueGenerated: s.revenue,
        averageOrderTime: s.orderCount > 0 ? (s.totalTime / s.orderCount) / 60000 : 0,
        ordersPerHour: 0, // Would need shift data
        averageRating: 0, // Would need feedback data
        efficiencyScore: Math.min(100, (s.revenue / 100) * 100), // Simplified
      }))
      .sort((a, b) => b.revenueGenerated - a.revenueGenerated);

    const totalStaff = staff?.length || 1;
    const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

    return {
      staffMembers,
      totalStaff,
      averageOrdersPerStaff: (orders?.length || 0) / totalStaff,
      averageRevenuePerStaff: totalRevenue / totalStaff,
      topPerformer: staffMembers[0] ? {
        staffId: "",
        name: staffMembers[0].name,
        revenue: staffMembers[0].revenueGenerated,
      } : null,
    };
  }

  // ========================================
  // DASHBOARD METRICS
  // ========================================

  /**
   * Get dashboard metrics for a venue
   */
  static async getDashboardMetrics(venueId: string): Promise<DashboardMetrics> {
    const cacheKey = `analytics:dashboard:${venueId}`;
    
    return this.withCache(cacheKey, () => this.computeDashboardMetrics(venueId), 60);
  }

  private static async computeDashboardMetrics(venueId: string): Promise<DashboardMetrics> {
    const supabase = await this.getSupabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's data
    const [activeOrdersResult, pendingOrdersResult, todayOrdersResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total_amount")
        .eq("venue_id", venueId)
        .in("status", ["confirmed", "preparing", "ready"])
        .gte("created_at", today.toISOString()),
      
      supabase
        .from("orders")
        .select("id")
        .eq("venue_id", venueId)
        .eq("status", "pending")
        .gte("created_at", today.toISOString()),
      
      supabase
        .from("orders")
        .select("total_amount")
        .eq("venue_id", venueId)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString()),
    ]);

    const activeOrders = activeOrdersResult.data?.length || 0;
    const pendingOrders = pendingOrdersResult.data?.length || 0;
    const todayOrders = todayOrdersResult.data?.length || 0;
    const todayRevenue = todayOrdersResult.data?.reduce(
      (sum, o) => sum + (o.total_amount || 0), 0
    ) || 0;

    // Get period data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: periodOrders } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("venue_id", venueId)
      .gte("created_at", thirtyDaysAgo.toISOString());

    const periodRevenue = periodOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
    const periodOrdersCount = periodOrders?.length || 0;

    return {
      activeOrders,
      pendingOrders,
      todayRevenue,
      todayOrders,
      periodRevenue,
      periodOrders: periodOrdersCount,
      periodAverageOrderValue: periodOrdersCount > 0 ? periodRevenue / periodOrdersCount : 0,
      periodGrowth: 0, // Would need previous period comparison
      quickStats: [
        { label: "Today's Revenue", value: `$${todayRevenue.toFixed(2)}` },
        { label: "Active Orders", value: activeOrders },
        { label: "Pending", value: pendingOrders },
        { label: "This Month", value: `$${periodRevenue.toFixed(2)}` },
      ],
      alerts: [],
    };
  }

  // ========================================
  // REPORT GENERATION
  // ========================================

  /**
   * Generate a custom report
   */
  static async generateReport(
    venueId: string,
    config: ReportConfiguration
  ): Promise<GeneratedReport> {
    const filters: AnalyticsFilters = {
      ...config.filters,
      venueId,
    };

    let data: Record<string, unknown>[] = [];
    let summary: Record<string, unknown> = {};

    switch (config.type) {
      case "revenue": {
        const analytics = await this.getRevenueAnalytics(venueId, filters);
        data = analytics.dailyBreakdown.map(d => ({
          date: d.date,
          revenue: d.revenue,
          orders: d.orders,
          averageOrderValue: d.averageOrderValue,
        }));
        summary = {
          totalRevenue: analytics.totalRevenue,
          totalOrders: analytics.totalOrders,
          averageOrderValue: analytics.averageOrderValue,
          growth: analytics.revenueGrowth,
        };
        break;
      }
      case "orders": {
        const analytics = await this.getOrderAnalytics(venueId, filters);
        data = analytics.orderVolumeByDay.map(d => ({
          date: d.date,
          count: d.count,
          revenue: d.revenue,
        }));
        summary = {
          totalOrders: analytics.totalOrders,
          completedOrders: analytics.completedOrders,
          cancelledOrders: analytics.cancelledOrders,
          averageOrderValue: analytics.averageOrderValue,
        };
        break;
      }
      case "customers": {
        const analytics = await this.getCustomerAnalytics(venueId, filters);
        data = analytics.topCustomers.map(c => ({
          name: c.customerName,
          totalRevenue: c.totalRevenue,
          orderCount: c.orderCount,
          lastOrder: c.lastOrderDate,
        }));
        summary = {
          totalCustomers: analytics.totalCustomers,
          newCustomers: analytics.newCustomers,
          retentionRate: analytics.retentionRate,
          averageLifetimeValue: analytics.averageLifetimeValue,
        };
        break;
      }
      default:
        throw new Error(`Unsupported report type: ${config.type}`);
    }

    return {
      id: crypto.randomUUID(),
      configurationId: config.id,
      type: config.type,
      generatedAt: new Date().toISOString(),
      dateRange: config.filters.dateRange,
      data,
      summary,
    };
  }

  /**
   * Execute with caching
   */
  private static async withCache<T>(
    key: string,
    callback: () => Promise<T>,
    ttl: number = AnalyticsService.CACHE_TTL
  ): Promise<T> {
    // Skip caching in test mode
    if (process.env.NODE_ENV === "test") {
      return callback();
    }

    // Try cache first
    const cached = await cache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute and cache
    const value = await callback();
    await cache.set(key, value, { ttl });
    return value;
  }
}
