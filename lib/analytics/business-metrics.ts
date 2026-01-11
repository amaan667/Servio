import { supabaseBrowser } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BusinessMetrics {
  // Revenue metrics

  }>;

  }>;

  // Table metrics

}

export class BusinessMetricsService {
  /**
   * Get comprehensive business metrics for a venue
   */
  static async getVenueMetrics(

    }
  ): Promise<BusinessMetrics> {
    try {
      const supabase = supabaseBrowser();

      // Get all metrics in parallel
      const [
        revenueMetrics,
        orderMetrics,
        customerMetrics,
        performanceMetrics,
        menuMetrics,
        tableMetrics,
        staffMetrics,
      ] = await Promise.all([
        this.getRevenueMetrics(supabase, venueId, dateRange),
        this.getOrderMetrics(supabase, venueId),
        this.getCustomerMetrics(supabase, venueId, dateRange),
        this.getPerformanceMetrics(supabase, venueId, dateRange),
        this.getMenuMetrics(supabase, venueId, dateRange),
        this.getTableMetrics(supabase, venueId, dateRange),
        this.getStaffMetrics(supabase, venueId, dateRange),
      ]);

      return {
        ...revenueMetrics,
        ...orderMetrics,
        ...customerMetrics,
        ...performanceMetrics,
        ...menuMetrics,
        ...tableMetrics,
        ...staffMetrics,
      };
    } catch (_error) {
      
      throw _error;
    }
  }

  /**
   * Get revenue metrics
   */
  private static async getRevenueMetrics(

    dateRange: { start: Date; end: Date }
  ) {
    const { data: orders } = await supabase
      .from("orders")
      .select("total_amount, created_at")
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());

    const totalRevenue =
      orders?.reduce(
        (sum: number, order: { total_amount: number }) => sum + order.total_amount,
        0
      ) || 0;
    const averageOrderValue = orders?.length ? totalRevenue / orders.length : 0;

    // Calculate growth (compare with previous period)
    const previousStart = new Date(dateRange.start);
    previousStart.setDate(
      previousStart.getDate() -
        (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const previousEnd = new Date(dateRange.start);

    const { data: previousOrders } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("venue_id", venueId)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    const previousRevenue =
      previousOrders?.reduce(
        (sum: number, order: { total_amount: number }) => sum + order.total_amount,
        0
      ) || 0;
    const revenueGrowth =
      previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    return {
      totalRevenue,
      averageOrderValue,
      revenueGrowth,
    };
  }

  /**
   * Get order metrics
   */
  private static async getOrderMetrics(supabase: SupabaseClient, venueId: string) {
    const { data: allOrders } = await supabase
      .from("orders")
      .select("created_at")
      .eq("venue_id", venueId);

    const totalOrders = allOrders?.length || 0;

    // Today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayOrders } = await supabase
      .from("orders")
      .select("created_at")
      .eq("venue_id", venueId)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString());

    const ordersToday = todayOrders?.length || 0;

    // This week's orders
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - today.getDay());

    const { data: weekOrders } = await supabase
      .from("orders")
      .select("created_at")
      .eq("venue_id", venueId)
      .gte("created_at", weekStart.toISOString());

    const ordersThisWeek = weekOrders?.length || 0;

    // This month's orders
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: monthOrders } = await supabase
      .from("orders")
      .select("created_at")
      .eq("venue_id", venueId)
      .gte("created_at", monthStart.toISOString());

    const ordersThisMonth = monthOrders?.length || 0;

    // Calculate growth
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(weekStart);

    const { data: previousWeekOrders } = await supabase
      .from("orders")
      .select("created_at")
      .eq("venue_id", venueId)
      .gte("created_at", previousWeekStart.toISOString())
      .lt("created_at", previousWeekEnd.toISOString());

    const previousWeekCount = previousWeekOrders?.length || 0;
    const orderGrowth =
      previousWeekCount > 0 ? ((ordersThisWeek - previousWeekCount) / previousWeekCount) * 100 : 0;

    return {
      totalOrders,
      ordersToday,
      ordersThisWeek,
      ordersThisMonth,
      orderGrowth,
    };
  }

  /**
   * Get customer metrics
   */
  private static async getCustomerMetrics(

    dateRange: { start: Date; end: Date }
  ) {
    const { data: customers } = await supabase
      .from("orders")
      .select("customer_name, created_at")
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());

    const uniqueCustomers = new Set(
      customers?.map((order: { customer_name: string }) => order.customer_name) || []
    );
    const totalCustomers = uniqueCustomers.size;

    // New customers (first order in this period)
    const { data: allCustomerOrders } = await supabase
      .from("orders")
      .select("customer_name, created_at")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: true });

    const customerFirstOrders = new Map<string, string>();
    allCustomerOrders?.forEach((order: { customer_name: string; created_at: string }) => {
      if (!customerFirstOrders.has(order.customer_name)) {
        customerFirstOrders.set(order.customer_name, order.created_at);
      }

    const newCustomers = Array.from(customerFirstOrders.entries()).filter(
      ([, firstOrder]) =>
        new Date(firstOrder) >= dateRange.start && new Date(firstOrder) <= dateRange.end
    ).length;

    const returningCustomers = totalCustomers - newCustomers;
    const customerRetentionRate =
      totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      customerRetentionRate,
    };
  }

  /**
   * Get performance metrics
   */
  private static async getPerformanceMetrics(

    dateRange: { start: Date; end: Date }
  ) {
    const { data: orders } = await supabase
      .from("orders")
      .select("created_at, updated_at, status")
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());

    // Calculate average order time
    const completedOrders =
      orders?.filter((order: { status: string }) => order.status === "served") || [];
    const averageOrderTime =
      completedOrders.length > 0
        ? completedOrders.reduce(
            (sum: number, order: { created_at: string; updated_at: string }) => {
              const created = new Date(order.created_at);
              const updated = new Date(order.updated_at);
              return sum + (updated.getTime() - created.getTime());
            },
            0
          ) /
          completedOrders.length /
          (1000 * 60) // Convert to minutes

    const hourCounts = new Map<number, number>();
    orders?.forEach((order: { created_at: string }) => {
      const hour = new Date(order.created_at).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);

    const peakHours = Array.from(hourCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    // Find busiest day
    const dayCounts = new Map<string, number>();
    orders?.forEach((order: { created_at: string }) => {
      const day = new Date(order.created_at).toLocaleDateString("en-US", { weekday: "long" });
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);

    const busiestDay =
      Array.from(dayCounts.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] || "Unknown";

    return {
      averageOrderTime,
      peakHours,
      busiestDay,
    };
  }

  /**
   * Get menu metrics
   */
  private static async getMenuMetrics(

    dateRange: { start: Date; end: Date }
  ) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(
        `
        quantity,
        price,
        menu_items (
          name
        )
      `
      )
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());

    const itemStats = new Map<string, { quantity: number; revenue: number }>();

    interface OrderItemWithMenu {

      menu_items: { name: string } | null;
    }

    (orderItems as unknown as OrderItemWithMenu[] | null)?.forEach((item) => {
      const name = item.menu_items?.name || "Unknown";
      const existing = itemStats.get(name) || { quantity: 0, revenue: 0 };
      itemStats.set(name, {

    const sortedItems = Array.from(itemStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.quantity - a.quantity);

    const topSellingItems = sortedItems.slice(0, 5);
    const leastSellingItems = sortedItems.slice(-5).reverse();

    return {
      topSellingItems,
      leastSellingItems,
    };
  }

  /**
   * Get table metrics
   */
  private static async getTableMetrics(

    dateRange: { start: Date; end: Date }
  ) {
    const { data: tables } = await supabase
      .from("tables")
      .select("id, seat_count")
      .eq("venue_id", venueId);

    const { data: orders } = await supabase
      .from("orders")
      .select("table_id, created_at")
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());

    // const totalSeats = tables?.reduce((sum, table) => sum + table.seat_count, 0) || 0;
    const usedTables = new Set(
      orders
        ?.map((order: { table_id: string | null }) => order.table_id)
        .filter((id: string | null): id is string => id !== null) || []
    );
    const tableUtilization = tables?.length ? (usedTables.size / tables.length) * 100 : 0;

    // Calculate average table turnover (orders per table per day)
    const daysInPeriod = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const averageTableTurnover = tables?.length
      ? (orders?.length || 0) / tables.length / daysInPeriod

      averageTableTurnover,
    };
  }

  /**
   * Get staff metrics
   */
  private static async getStaffMetrics(

    dateRange: { start: Date; end: Date }
  ) {
    const { data: staff } = await supabase
      .from("user_venue_roles")
      .select("user_id, role")
      .eq("venue_id", venueId)
      .neq("role", "owner");

    const { data: orders } = await supabase
      .from("orders")
      .select("created_at")
      .eq("venue_id", venueId)
      .gte("created_at", dateRange.start.toISOString())
      .lte("created_at", dateRange.end.toISOString());

    const staffCount = staff?.length || 1; // Avoid division by zero
    const ordersPerStaff = (orders?.length || 0) / staffCount;

    // Simple efficiency metric (could be enhanced with more complex logic)
    const staffEfficiency = Math.min(100, (ordersPerStaff / 10) * 100); // Assuming 10 orders per staff per day is 100% efficiency

    return {
      staffEfficiency,
      ordersPerStaff,
    };
  }

  /**
   * Get real-time metrics for dashboard
   */
  static async getRealTimeMetrics(venueId: string): Promise<{

  }> {
    try {
      const supabase = supabaseBrowser();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [activeOrdersResult, pendingOrdersResult, todayOrdersResult] = await Promise.all([
        supabase
          .from("orders")
          .select("id")
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
      const todayRevenue =
        todayOrdersResult.data?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

      return {
        activeOrders,
        pendingOrders,
        todayRevenue,
        todayOrders,
      };
    } catch (_error) {
      
      throw _error;
    }
  }
}
