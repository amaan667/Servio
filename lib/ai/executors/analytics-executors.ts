import { createClient } from "@/lib/supabase";
import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";
import type { AnalyticsInsightsParams } from "@/types/ai-params";

interface OrderItemWithOrders {
  menu_item_id: string;
  quantity: number;
  price: number;
  orders: {
    id: string;
    created_at: string;
    venue_id: string;
  };
}

interface OrderItemWithMenuItems {
  menu_item_id: string;
  quantity: number;
  price: number;
  menu_items: {
    name: string;
  };
}

export async function executeAnalyticsGetInsights(
  params: AnalyticsInsightsParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  if (preview) {
    const itemContext = params.itemName ? ` for item: ${params.itemName}` : "";
    return {
      toolName: "analytics.get_insights",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        description: `Will generate insights for ${params.timeRange}${itemContext}`,
      },
    };
  }

  const now = new Date();
  let startDate = new Date();

  switch (params.timeRange) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      break;
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "quarter":
      startDate.setMonth(now.getMonth() - 3);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case "custom":
      if (params.customRange) {
        startDate = new Date(params.customRange.start);
      }
      break;
  }

  if (params.itemId) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select(
        `
        menu_item_id,
        quantity,
        price,
        orders!inner(
          id,
          created_at,
          venue_id
        )
      `
      )
      .eq("orders.venue_id", venueId)
      .eq("menu_item_id", params.itemId)
      .gte("orders.created_at", startDate.toISOString());

    const totalRevenue =
      orderItems?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    const totalQuantity = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const orderCount = new Set(
      (orderItems as unknown as OrderItemWithOrders[])?.map((item) => item.orders.id)
    ).size;

    const insights = {
      itemName: params.itemName || "Unknown Item",
      itemId: params.itemId,
      timeRange: params.timeRange,
      totalRevenue,
      quantitySold: totalQuantity,
      orderCount,
      averagePerOrder: orderCount > 0 ? totalRevenue / orderCount : 0,
      message: `${params.itemName || "Item"}: £${totalRevenue.toFixed(2)} revenue, ${totalQuantity} units sold, ${orderCount} orders (${params.timeRange})`,
    };

    return {
      success: true,
      toolName: "analytics.get_insights",
      result: insights,
      auditId: "",
    };
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("venue_id", venueId)
    .gte("created_at", startDate.toISOString());

  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

  const insights = {
    timeRange: params.timeRange,
    totalRevenue,
    orderCount: orders?.length || 0,
    avgOrderValue: orders?.length ? totalRevenue / orders.length : 0,
    message: `Total: £${totalRevenue.toFixed(2)} revenue from ${orders?.length || 0} orders (${params.timeRange})`,
  };

  return {
    success: true,
    toolName: "analytics.get_insights",
    result: insights,
    auditId: "",
  };
}

export async function executeAnalyticsExport(
  params: { timeRange: string; format: string; type?: string },
  _venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "analytics.export",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        description: `Will export ${params.type || "analytics"} data in ${params.format} format`,
      },
    };
  }

  return {
    success: true,
    toolName: "analytics.export",
    result: {
      message: "Export functionality requires file generation service",
      type: params.type || "analytics",
      format: params.format,
    },
    auditId: "",
  };
}

export async function executeAnalyticsGetStats(
  params: AnalyticsInsightsParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  if (preview) {
    const itemContext = params.itemName ? ` for item: ${params.itemName}` : "";
    return {
      toolName: "analytics.get_stats",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        estimatedRevenue: 0,
        description: `Will generate statistics for ${params.timeRange}${itemContext}`,
      },
    };
  }

  let stats = {
    /* Empty */
  };

  try {
    const timeStart = getTimeRangeStart(params.timeRange);

    if (params.itemId) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(
          `
          menu_item_id,
          quantity,
          price,
          orders!inner(
            id,
            created_at,
            venue_id,
            total_amount
          )
        `
        )
        .eq("orders.venue_id", venueId)
        .eq("menu_item_id", params.itemId)
        .gte("orders.created_at", timeStart);

      const totalRevenue =
        orderItems?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
      const totalQuantity = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const orderCount = new Set(
        (orderItems as unknown as OrderItemWithOrders[])?.map((item) => item.orders.id)
      ).size;

      stats = {
        itemName: params.itemName || "Unknown Item",
        itemId: params.itemId,
        timeRange: params.timeRange,
        revenue: totalRevenue,
        quantitySold: totalQuantity,
        orderCount: orderCount,
        averagePerOrder: orderCount > 0 ? totalRevenue / orderCount : 0,
        message: `${params.itemName || "Item"} generated £${totalRevenue.toFixed(2)} in revenue from ${totalQuantity} units sold across ${orderCount} orders in the ${params.timeRange}.`,
      };
    } else {
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .gte("created_at", timeStart);

      // Generate revenue stats by default
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

      // Get top items
      const topItemsQuery = await supabase
        .from("order_items")
        .select(
          `
            menu_item_id,
            quantity,
            price,
            menu_items!inner(name),
            orders!inner(venue_id, created_at)
          `
        )
        .eq("orders.venue_id", venueId)
        .gte("orders.created_at", timeStart);

      const itemSales = new Map();
      (topItemsQuery.data as unknown as OrderItemWithMenuItems[] | null)?.forEach((item) => {
        const existing = itemSales.get(item.menu_item_id) || {
          name: item.menu_items.name,
          quantity: 0,
          revenue: 0,
        };
        itemSales.set(item.menu_item_id, {
          name: existing.name,
          quantity: existing.quantity + item.quantity,
          revenue:
            existing.revenue +
            (typeof item.price === "number" ? item.price : 0) *
              (typeof item.quantity === "number" ? item.quantity : 0),
        });
      });

      const top10 = Array.from(itemSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      stats = {
        revenue: {
          total: totalRevenue,
          count: orders?.length || 0,
          average: orders?.length ? totalRevenue / orders.length : 0,
        },
        orders: {
          count: orders?.length || 0,
        },
        topItems: top10,
        timeRange: params.timeRange,
        message: `Analytics for ${params.timeRange}: £${totalRevenue.toFixed(2)} revenue from ${orders?.length || 0} orders`,
      };
    }
  } catch (_error) {
    const errorDetails =
      _error instanceof Error
        ? { message: _error.message, stack: _error.stack }
        : { error: String(_error) };
    throw new AIAssistantError("Failed to get analytics data", "EXECUTION_FAILED", errorDetails);
  }

  return {
    success: true,
    toolName: "analytics.get_stats",
    result: stats,
    auditId: "",
  };
}

export async function executeAnalyticsCreateReport(
  _params: unknown,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const typedParams = _params as {
    name: string;
    metrics: unknown[];
    timeRange: string;
    format: string;
  };

  if (preview) {
    return {
      toolName: "analytics.create_report",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        estimatedRevenue: 0,
        description: `Will create report "${typedParams.name}" with ${typedParams.metrics.length} metrics in ${typedParams.format} format`,
      },
    };
  }

  const report = {
    name: typedParams.name,
    metrics: typedParams.metrics,
    timeRange: typedParams.timeRange,
    format: typedParams.format,
    createdAt: new Date().toISOString(),
    venueId,
    createdBy: _userId,
  };

  return {
    success: true,
    toolName: "analytics.create_report",
    result: report,
    auditId: "",
  };
}

function getTimeRangeStart(timeRange: string): string {
  const now = new Date();
  switch (timeRange) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate()
      ).toISOString();
    }
    case "week":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "month":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "quarter":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    case "year":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}
