import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser as createClient } from "@/lib/supabase";

export interface AnalyticsData {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  menuItemsCount: number;
  revenueOverTime: Array<{
    date: string;
    revenue: number;
    orders: number;
    isCurrentPeriod?: boolean;
    isPeak?: boolean;
    isLowest?: boolean;
  }>;
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
  trendline: number;
  peakDay: { date: string; revenue: number };
  lowestDay: { date: string; revenue: number };
}

export type TimePeriod = "7d" | "30d" | "3m" | "1y";

export function useAnalyticsData(
  venueId: string,
  timePeriod: TimePeriod,
  customDateRange: { start: string; end: string } | null
) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    menuItemsCount: 0,
    revenueOverTime: [],
    topSellingItems: [],
    trendline: 0,
    peakDay: { date: "", revenue: 0 },
    lowestDay: { date: "", revenue: 0 },
  });
  const [filteredOrders, setFilteredOrders] = useState<unknown[]>([]);

  const getDateRange = useCallback((period: TimePeriod) => {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case "7d":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "3m":
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case "1y":
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = customDateRange
        ? {
            startDate: new Date(customDateRange.start),
            endDate: new Date(customDateRange.end),
          }
        : getDateRange(timePeriod);

      const supabase = createClient();
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          id,
          total_amount,
          created_at,
          order_status,
          table_number,
          payment_method,
          items
        `
        )
        .eq("venue_id", venueId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });

      if (ordersError) {
        throw new Error(`Failed to fetch orders: ${ordersError.message}`);
      }

      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id")
        .eq("venue_id", venueId)
        .eq("is_available", true);

      const validOrders = (orders || []).filter((order: Record<string, unknown>) => {
        const totalAmount = typeof order.total_amount === "number" ? order.total_amount : 0;
        return (
          order.order_status !== "CANCELLED" &&
          totalAmount > 0 &&
          order.venue_id !== "demo-cafe" &&
          order.payment_method !== "demo"
        );
      });

      const totalOrders = validOrders.length;
      const totalRevenue = validOrders.reduce((sum: number, order: Record<string, unknown>) => {
        const amount = typeof order.total_amount === "number" ? order.total_amount : 0;
        return sum + amount;
      }, 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const menuItemsCount = menuItems?.length || 0;

      // Generate revenue over time data
      const revenueOverTime = generateRevenueOverTime(validOrders, startDate, endDate, timePeriod);

      // Generate top selling items
      const topSellingItems = generateTopSellingItems(validOrders);

      // Calculate trendline
      const trendline =
        revenueOverTime.length > 0
          ? revenueOverTime.reduce((sum, period) => sum + period.revenue, 0) /
            revenueOverTime.length
          : 0;

      // Find peak and lowest days
      const { peakDay, lowestDay } = findPeakAndLowestDays(revenueOverTime);

      // Mark current period
      markCurrentPeriod(revenueOverTime, timePeriod);

      setAnalyticsData({
        totalOrders,
        totalRevenue,
        averageOrderValue,
        menuItemsCount,
        revenueOverTime,
        topSellingItems,
        trendline,
        peakDay,
        lowestDay,
      });

      setFilteredOrders(validOrders);
    } catch (_err) {
      const errorMessage = _err instanceof Error ? _err.message : "Failed to load analytics data";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [venueId, timePeriod, customDateRange, getDateRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  return {
    loading,
    error,
    analyticsData,
    filteredOrders,
    refetch: fetchAnalyticsData,
  };
}

function generateRevenueOverTime(
  orders: Record<string, unknown>[],
  startDate: Date,
  endDate: Date,
  timePeriod: TimePeriod
): Array<{
  date: string;
  revenue: number;
  orders: number;
  isCurrentPeriod?: boolean;
  isPeak?: boolean;
  isLowest?: boolean;
}> {
  const revenueOverTime: Array<{
    date: string;
    revenue: number;
    orders: number;
    isCurrentPeriod?: boolean;
    isPeak?: boolean;
    isLowest?: boolean;
  }> = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  let interval = 1;
  let dateFormat: "day" | "week" | "month" = "day";

  if (timePeriod === "3m") {
    interval = 7;
    dateFormat = "week";
  } else if (timePeriod === "1y") {
    interval = 30;
    dateFormat = "month";
  }

  const periods: Array<{ date: string; dateObj: Date }> = [];
  for (let i = 0; i < daysDiff; i += interval) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0]!;
    periods.push({ date: dateStr, dateObj: date });
  }

  if (timePeriod === "7d" || timePeriod === "30d") {
    const allDays: Array<{ date: string; dateObj: Date }> = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDays.push({
        date: currentDate.toISOString().split("T")[0]!,
        dateObj: new Date(currentDate),
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    periods.length = 0;
    periods.push(...allDays);
  }

  for (const period of periods) {
    const dateStr = period.date;
    let periodOrdersList: Record<string, unknown>[] = [];

    if (dateFormat === "day") {
      periodOrdersList = orders.filter((order: Record<string, unknown>) => {
        const createdAt = typeof order.created_at === "string" ? order.created_at : "";
        const orderDate = createdAt.split("T")[0];
        return orderDate === dateStr;
      });
    } else if (dateFormat === "week") {
      const endOfWeek = new Date(period.dateObj);
      endOfWeek.setDate(period.dateObj.getDate() + 6);
      const weekEndStr = endOfWeek.toISOString().split("T")[0];

      periodOrdersList = orders.filter((order: Record<string, unknown>) => {
        const createdAt = typeof order.created_at === "string" ? order.created_at : "";
        const orderDate = createdAt.split("T")[0] ?? "";
        return orderDate >= dateStr && orderDate <= (weekEndStr ?? "");
      });
    } else if (dateFormat === "month") {
      const endOfMonth = new Date(period.dateObj);
      endOfMonth.setMonth(period.dateObj.getMonth() + 1, 0);
      const monthEndStr = endOfMonth.toISOString().split("T")[0];

      periodOrdersList = orders.filter((order: Record<string, unknown>) => {
        const createdAt = typeof order.created_at === "string" ? order.created_at : "";
        const orderDate = createdAt.split("T")[0] ?? "";
        return orderDate >= dateStr && orderDate <= (monthEndStr ?? "");
      });
    }

    const periodRevenue = periodOrdersList.reduce((sum: number, order: Record<string, unknown>) => {
      const amount = typeof order.total_amount === "number" ? order.total_amount : 0;
      return sum + amount;
    }, 0);
    const periodOrders = periodOrdersList.length;

    revenueOverTime.push({
      date: dateStr,
      revenue: periodRevenue,
      orders: periodOrders,
      isCurrentPeriod: false,
      isPeak: false,
      isLowest: false,
    });
  }

  return revenueOverTime;
}

function generateTopSellingItems(orders: Record<string, unknown>[]) {
  const itemSales = new Map<string, { name: string; quantity: number; revenue: number }>();

  orders.forEach((order: Record<string, unknown>) => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item: Record<string, unknown>) => {
        const itemName =
          (typeof item.item_name === "string" ? item.item_name : null) ||
          (typeof item.name === "string" ? item.name : null) ||
          "Unknown Item";
        const quantity = typeof item.quantity === "number" ? item.quantity : 0;
        const price = typeof item.price === "number" ? item.price : 0;
        const revenue = quantity * price;

        if (itemSales.has(itemName)) {
          const existing = itemSales.get(itemName)!;
          existing.quantity += quantity;
          existing.revenue += revenue;
        } else {
          itemSales.set(itemName, { name: itemName, quantity, revenue });
        }
      });
    }
  });

  return Array.from(itemSales.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);
}

function findPeakAndLowestDays(
  revenueOverTime: Array<{ date: string; revenue: number; isPeak?: boolean; isLowest?: boolean }>
) {
  let peakDay = { date: "", revenue: 0 };
  let lowestDay = { date: "", revenue: 0 };

  if (revenueOverTime.length > 0) {
    const sortedByRevenue = [...revenueOverTime].sort((a, b) => b.revenue - a.revenue);
    const first = sortedByRevenue[0]!;
    const last = sortedByRevenue[sortedByRevenue.length - 1]!;
    peakDay = { date: first.date, revenue: first.revenue };
    lowestDay = {
      date: last.date,
      revenue: last.revenue,
    };

    revenueOverTime.forEach((period) => {
      const periodRecord = period as {
        date: string;
        revenue: number;
        isPeak?: boolean;
        isLowest?: boolean;
      };
      if (periodRecord.date === peakDay.date) periodRecord.isPeak = true;
      if (periodRecord.date === lowestDay.date) periodRecord.isLowest = true;
    });
  }

  return { peakDay, lowestDay };
}

function markCurrentPeriod(
  revenueOverTime: Array<{
    date: string;
    revenue: number;
    orders: number;
    isCurrentPeriod?: boolean;
  }>,
  timePeriod: TimePeriod
) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  let dateFormat: "day" | "week" | "month" = "day";
  if (timePeriod === "3m") dateFormat = "week";
  else if (timePeriod === "1y") dateFormat = "month";

  revenueOverTime.forEach((period) => {
    if (dateFormat === "day" && period.date === todayStr) {
      period.isCurrentPeriod = true;
    } else if (dateFormat === "week") {
      const periodDate = new Date(period.date);
      const weekStart = new Date(periodDate);
      weekStart.setDate(periodDate.getDate() - periodDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      if (now >= weekStart && now <= weekEnd) {
        period.isCurrentPeriod = true;
      }
    } else if (dateFormat === "month") {
      const periodDate = new Date(period.date);
      if (
        now.getMonth() === periodDate.getMonth() &&
        now.getFullYear() === periodDate.getFullYear()
      ) {
        period.isCurrentPeriod = true;
      }
    }
  });
}
