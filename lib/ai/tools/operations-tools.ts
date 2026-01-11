// Servio AI Assistant - Operational Efficiency Tools
// Kitchen optimization, staff scheduling, waste reduction

import { createClient } from "@/lib/supabase";

interface KitchenBottleneckResult {

  }>;

}

interface StaffScheduleResult {

  }>;

}

interface WasteAnalysisResult {

  }>;

}

interface TableTurnoverResult {

  }>;

}

/**
 * Analyze kitchen operations to identify bottlenecks
 */
export async function analyzeKitchenBottlenecks(venueId: string): Promise<KitchenBottleneckResult> {
  const supabase = await createClient();

  // Get KDS tickets from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: tickets } = await supabase
    .from("kds_tickets")
    .select("*")
    .eq("venue_id", venueId)
    .gte("created_at", sevenDaysAgo.toISOString());

  if (!tickets || tickets.length === 0) {
    return {

    };
  }

  // Group by station
  const stationStats = new Map<
    string,
    {

    }
  >();

  tickets.forEach((ticket) => {
    const station = ticket.station_name || "Unknown";
    const stats = stationStats.get(station) || {

    };

    stats.total++;

    if (ticket.status === "in_progress") {
      stats.inProgress++;
    }

    if (ticket.started_at && ticket.completed_at) {
      const prepTime =
        (new Date(ticket.completed_at).getTime() - new Date(ticket.started_at).getTime()) / 60000; // minutes
      stats.prepTimes.push(prepTime);
    }

    // Check if overdue (>15 min in progress)
    if (ticket.status === "in_progress" && ticket.started_at) {
      const timeInProgress = (Date.now() - new Date(ticket.started_at).getTime()) / 60000;
      if (timeInProgress > 15) {
        stats.overdue++;
      }
    }

    stationStats.set(station, stats);

  const bottlenecks = Array.from(stationStats.entries()).map(([station, stats]) => {
    const avgPrepTime =
      stats.prepTimes.length > 0
        ? stats.prepTimes.reduce((a, b) => a + b, 0) / stats.prepTimes.length

      recommendation = `Slow station - avg prep time ${avgPrepTime.toFixed(1)} min. Consider additional staff or equipment.`;
    } else if (stats.overdue > 5) {
      recommendation = `${stats.overdue} overdue tickets. Check for process bottlenecks or staffing issues.`;
    } else if (stats.inProgress > 10) {
      recommendation = `${stats.inProgress} tickets in progress. Station may be overwhelmed during peak hours.`;
    } else {
      recommendation = "Station operating efficiently.";
    }

    return {
      station,

      recommendation,
    };

  // Sort by avg prep time (slowest first)
  bottlenecks.sort((a, b) => b.avgPrepTime - a.avgPrepTime);

  const summary =
    bottlenecks.length > 0
      ? `Slowest station: ${bottlenecks[0].station} (${bottlenecks[0].avgPrepTime} min avg). ${bottlenecks.filter((b) => b.overdueTickets > 0).length} stations have overdue tickets.`

    summary,
  };
}

/**
 * Suggest optimal staff scheduling based on demand patterns
 */
export async function optimizeStaffSchedule(venueId: string): Promise<StaffScheduleResult> {
  const supabase = await createClient();

  // Get last 30 days of orders
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("created_at, total_amount")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  if (!orders || orders.length < 20) {
    return {

    };
  }

  // Group by day of week and hour
  const demandMap = new Map<string, number>();

  orders.forEach((order) => {
    const date = new Date(order.created_at);
    const dayOfWeek = date.getDay(); // 0=Sunday
    const hour = date.getHours();
    const timeSlot = `${hour}:00-${hour + 1}:00`;
    const key = `${dayOfWeek}-${hour}`;

    demandMap.set(key, (demandMap.get(key) || 0) + 1);

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Calculate recommendations
  const recommendations: StaffScheduleResult["recommendations"] = [];

  for (let day = 0; day < 7; day++) {
    const dayOrders: number[] = [];
    for (let hour = 7; hour < 23; hour++) {
      // 7am to 11pm
      const key = `${day}-${hour}`;
      dayOrders.push(demandMap.get(key) || 0);
    }

    const maxOrders = Math.max(...dayOrders);
    const avgOrders = dayOrders.reduce((a, b) => a + b, 0) / dayOrders.length;

    // Find peak hours
    dayOrders.forEach((orders, index) => {
      const hour = index + 7;
      if (orders >= avgOrders * 1.5) {
        // 50% above average = peak
        const suggestedStaff = Math.ceil(orders / 5); // Rough estimate: 1 staff per 5 orders/hour

        recommendations.push({

          timeSlot: `${hour}:00-${hour + 1}:00`,
          suggestedStaff,
          reasoning: `Peak period with ${orders} orders/hour (${((orders / avgOrders - 1) * 100).toFixed(0)}% above average)`,

      }

  }

  // Sort by expected orders (busiest first)
  recommendations.sort((a, b) => b.expectedOrders - a.expectedOrders);

  const summary =
    recommendations.length > 0
      ? `Identified ${recommendations.length} peak periods. Busiest: ${recommendations[0].dayOfWeek} ${recommendations[0].timeSlot} (${recommendations[0].expectedOrders} orders/hour).`

    recommendations: recommendations.slice(0, 10), // Top 10 busiest periods
    summary,
  };
}

/**
 * Analyze waste patterns to reduce food costs
 */
export async function analyzeWastePatterns(venueId: string): Promise<WasteAnalysisResult> {
  const supabase = await createClient();

  // Get menu items
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, category, price")
    .eq("venue_id", venueId);

  // Get recent orders (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("items, created_at")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  // Calculate demand for each item
  const salesMap = new Map<string, number>();
  orders?.forEach((order) => {
    const items = order.items as Array<{ item_name: string; quantity: number }>;
    items?.forEach((item) => {
      salesMap.set(item.item_name, (salesMap.get(item.item_name) || 0) + item.quantity);

  const wastePatterns: WasteAnalysisResult["wastePatterns"] = [];
  let totalEstimatedWaste = 0;

  // Identify items with low sales = potential waste
  menuItems?.forEach((item) => {
    const sales = salesMap.get(item.name) || 0;
    const avgDailySales = sales / 30;

    // Items selling less than 0.5 per day are at risk of waste
    if (avgDailySales < 0.5 && sales > 0) {
      const estimatedWastePercent = Math.min(70, 100 - avgDailySales * 100); // Max 70% waste
      const estimatedWaste = item.price * (estimatedWastePercent / 100);
      totalEstimatedWaste += estimatedWaste;

      let recommendation = "";
      if (sales === 0) {
        recommendation = "No sales in 30 days. Consider removing from menu.";
      } else if (avgDailySales < 0.3) {
        recommendation = `Very low sales (${sales} in 30 days). Reduce prep quantity or remove item.`;
      } else {
        recommendation = `Moderate sales (${sales} in 30 days). Prep smaller batches or make to order.`;
      }

      wastePatterns.push({

        estimatedWaste,

        recommendation,

    }

  // Sort by estimated waste (highest first)
  wastePatterns.sort((a, b) => b.estimatedWaste - a.estimatedWaste);

  const summary =
    wastePatterns.length > 0
      ? `Identified ${wastePatterns.length} items with potential waste. Estimated monthly waste cost: ${totalEstimatedWaste.toFixed(2)}. Focus on top 3 items for maximum impact.`

    wastePatterns: wastePatterns.slice(0, 15), // Top 15 waste items

    summary,
  };
}

/**
 * Improve table turnover rates
 */
export async function improveTurnover(venueId: string): Promise<TableTurnoverResult> {
  const supabase = await createClient();

  // Get completed orders from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("table_number, created_at, served_at, completed_at")
    .eq("venue_id", venueId)
    .eq("order_status", "COMPLETED")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("table_number", "is", null);

  if (!orders || orders.length === 0) {
    return {

    };
  }

  // Calculate turnover times
  const tableStats = new Map<number, { times: number[]; count: number }>();

  orders.forEach((order) => {
    if (!order.completed_at || !order.created_at) return;

    const turnoverTime =
      (new Date(order.completed_at).getTime() - new Date(order.created_at).getTime()) / 60000; // minutes

    const stats = tableStats.get(order.table_number) || { times: [], count: 0 };
    stats.times.push(turnoverTime);
    stats.count++;
    tableStats.set(order.table_number, stats);

  const byTable = Array.from(tableStats.entries()).map(([tableNumber, stats]) => ({
    tableNumber,
    avgTime: Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length),

  }));

  byTable.sort((a, b) => b.avgTime - a.avgTime); // Slowest first

  const allTimes = Array.from(tableStats.values()).flatMap((s) => s.times);
  const avgTurnoverTime = Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length);

  // Generate recommendations
  const recommendations: string[] = [];

  if (avgTurnoverTime > 45) {
    recommendations.push(
      `Average turnover of ${avgTurnoverTime} min is high. Consider offering quick-service menu items or streamlining payment.`
    );
  }

  if (byTable.length > 0 && byTable[0].avgTime > avgTurnoverTime * 1.3) {
    recommendations.push(
      `Table ${byTable[0].tableNumber} is ${Math.round((byTable[0].avgTime / avgTurnoverTime - 1) * 100)}% slower than average. Check for service issues at this table.`
    );
  }

  if (avgTurnoverTime < 30) {
    recommendations.push(
      `Excellent turnover time of ${avgTurnoverTime} min! Consider upselling to increase revenue per table.`
    );
  }

  return {
    avgTurnoverTime,
    byTable,
    recommendations,
  };
}
