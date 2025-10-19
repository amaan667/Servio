import { createClient } from "@/lib/supabase/server";
import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";

export async function executeAnalyticsGetInsights(
  params: any,
  venueId: string,
  userId: string,
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
      .select(`
        menu_item_id,
        quantity,
        price,
        orders!inner(
          id,
          created_at,
          venue_id
        )
      `)
      .eq("orders.venue_id", venueId)
      .eq("menu_item_id", params.itemId)
      .gte("orders.created_at", startDate.toISOString());

    const totalRevenue = orderItems?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
    const totalQuantity = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
    const orderCount = new Set(orderItems?.map((item: any) => item.orders.id)).size;

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
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "analytics.export",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        description: `Will export ${params.type} data in ${params.format} format`,
      },
    };
  }

  return {
    success: true,
    toolName: "analytics.export",
    result: { message: "Export functionality requires file generation service", type: params.type, format: params.format },
    auditId: "",
  };
}

export async function executeAnalyticsGetStats(
  params: any,
  venueId: string,
  userId: string,
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
        description: `Will generate ${params.metric} statistics for ${params.timeRange}${itemContext}`,
      },
    };
  }

  let stats = {};
  
  try {
    const timeStart = getTimeRangeStart(params.timeRange);
    
    if (params.itemId) {
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          menu_item_id,
          quantity,
          price,
          orders!inner(
            id,
            created_at,
            venue_id,
            total_amount
          )
        `)
        .eq("orders.venue_id", venueId)
        .eq("menu_item_id", params.itemId)
        .gte("orders.created_at", timeStart);

      const totalRevenue = orderItems?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0;
      const totalQuantity = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const orderCount = new Set(orderItems?.map((item: any) => item.orders.id)).size;

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

      switch (params.metric) {
        case "revenue":
          const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
          stats = {
            total: totalRevenue,
            count: orders?.length || 0,
            average: orders?.length ? totalRevenue / orders.length : 0,
            timeRange: params.timeRange,
            message: `Total revenue for ${params.timeRange}: £${totalRevenue.toFixed(2)} from ${orders?.length || 0} orders.`,
          };
          break;
        case "orders_count":
          stats = { 
            count: orders?.length || 0,
            timeRange: params.timeRange,
            message: `Total orders for ${params.timeRange}: ${orders?.length || 0}`,
          };
          break;
        case "top_items":
          const { data: topItems } = await supabase
            .from("order_items")
            .select(`
              menu_item_id,
              quantity,
              price,
              menu_items!inner(name),
              orders!inner(venue_id, created_at)
            `)
            .eq("orders.venue_id", venueId)
            .gte("orders.created_at", timeStart);

          const itemSales = new Map();
          topItems?.forEach((item: any) => {
            const existing = itemSales.get(item.menu_item_id) || { name: item.menu_items.name, quantity: 0, revenue: 0 };
            itemSales.set(item.menu_item_id, {
              name: existing.name,
              quantity: existing.quantity + item.quantity,
              revenue: existing.revenue + (item.price * item.quantity),
            });
          });

          const top10 = Array.from(itemSales.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

          stats = {
            topItems: top10,
            timeRange: params.timeRange,
            message: `Top ${top10.length} items by revenue for ${params.timeRange}`,
          };
          break;
        default:
          stats = { 
            message: `${params.metric} analysis for ${params.timeRange}`,
            timeRange: params.timeRange,
          };
      }
    }
  } catch (error) {
    throw new AIAssistantError("Failed to get analytics data", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "analytics.get_stats",
    result: stats,
    auditId: "",
  };
}

export async function executeAnalyticsCreateReport(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "analytics.create_report",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        estimatedRevenue: 0,
        description: `Will create report "${params.name}" with ${params.metrics.length} metrics in ${params.format} format`,
      },
    };
  }

  const report = {
    name: params.name,
    metrics: params.metrics,
    timeRange: params.timeRange,
    format: params.format,
    createdAt: new Date().toISOString(),
    venueId,
    createdBy: userId,
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
    case "yesterday":
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
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

