// Servio AI Assistant - Advanced Analytics Tools
// Revenue optimization, forecasting, and business intelligence

import { createClient } from "@/lib/supabase";

interface MenuPerformanceResult {

  }>;

  }>;

}

interface PriceOptimizationResult {

  }>;

}

interface RevenueForecastResult {

  };

}

/**
 * Analyze menu item performance to identify winners and losers
 */
export async function analyzeMenuPerformance(

  const { data: orders } = await supabase
    .from("orders")
    .select("items, total_amount, created_at")
    .eq("venue_id", venueId)
    .gte("created_at", startDate.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  // Aggregate by item
  const itemStats = new Map<string, { revenue: number; orders: number; lastOrdered: Date }>();

  orders?.forEach((order) => {
    const items = order.items as Array<{

    }>;
    items?.forEach((item) => {
      const existing = itemStats.get(item.item_name) || {

      };
      itemStats.set(item.item_name, {

  // Sort by revenue
  const sorted = Array.from(itemStats.entries())
    .map(([name, stats]) => ({
      name,

    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topPerformers = sorted.slice(0, 10);
  const underPerformers = sorted
    .slice(-10)
    .filter((item) => item.orders < 5)
    .map((item) => ({

    }));

  // Generate recommendations
  const recommendations: string[] = [];
  if (topPerformers.length > 0) {
    recommendations.push(
      `Your top item "${topPerformers[0].name}" generated ${topPerformers[0].revenue.toFixed(2)} in revenue. Consider featuring it more prominently.`
    );
  }
  if (underPerformers.length > 0) {
    recommendations.push(
      `${underPerformers.length} items selling poorly. Consider removing or repricing them to simplify your menu.`
    );
  }

  return {
    topPerformers,
    underPerformers,
    recommendations,
  };
}

/**
 * Suggest optimal pricing based on demand and competition
 */
export async function suggestPriceOptimization(venueId: string): Promise<PriceOptimizationResult> {
  const supabase = await createClient();

  // Get menu items
  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("id, name, price, category")
    .eq("venue_id", venueId)
    .eq("is_available", true);

  // Get recent sales data (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: orders } = await supabase
    .from("orders")
    .select("items")
    .eq("venue_id", venueId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  // Calculate demand for each item
  const demandMap = new Map<string, number>();
  orders?.forEach((order) => {
    const items = order.items as Array<{ item_name: string; quantity: number }>;
    items?.forEach((item) => {
      demandMap.set(item.item_name, (demandMap.get(item.item_name) || 0) + item.quantity);

  const suggestions: PriceOptimizationResult["suggestions"] = [];

  menuItems?.forEach((item) => {
    const demand = demandMap.get(item.name) || 0;
    const currentPrice = item.price;

    // High demand (>30 orders/month) = can increase price 5-10%
    if (demand > 30) {
      const increase = Math.round(currentPrice * 0.075 * 100) / 100; // 7.5% increase
      suggestions.push({

        currentPrice,

        reasoning: `High demand (${demand} orders/month). Market can support higher price.`,

    }
    // Low demand (<5 orders/month) = consider discount or removal
    else if (demand < 5 && demand > 0) {
      const decrease = Math.round(currentPrice * 0.15 * 100) / 100; // 15% decrease
      suggestions.push({

        currentPrice,

        reasoning: `Low demand (${demand} orders/month). Price reduction may boost sales.`,
        potentialRevenueIncrease: decrease * 10, // Estimate 10 additional sales

    }

  // Sort by potential revenue impact
  suggestions.sort((a, b) => b.potentialRevenueIncrease - a.potentialRevenueIncrease);

  const totalPotential = suggestions.reduce((sum, s) => sum + s.potentialRevenueIncrease, 0);

  return {
    suggestions: suggestions.slice(0, 5), // Top 5 suggestions
    summary: `Implementing these ${suggestions.length} pricing changes could increase monthly revenue by approximately ${totalPotential.toFixed(2)}.`,
  };
}

/**
 * Forecast future revenue based on historical trends
 */
export async function forecastRevenue(venueId: string): Promise<RevenueForecastResult> {
  const supabase = await createClient();

  // Get last 90 days of revenue data
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, created_at, currency")
    .eq("venue_id", venueId)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  if (!orders || orders.length < 7) {
    return {

      },

    };
  }

  // Group by week
  const weeklyRevenue: number[] = [];
  const weeksMap = new Map<number, number>();

  orders.forEach((order) => {
    const orderDate = new Date(order.created_at);
    const weekNumber = Math.floor((Date.now() - orderDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    weeksMap.set(weekNumber, (weeksMap.get(weekNumber) || 0) + order.total_amount);

  // Convert to array (most recent first)
  for (let i = 0; i < 12; i++) {
    weeklyRevenue.push(weeksMap.get(i) || 0);
  }

  // Simple linear regression for trend
  const avgWeekly = weeklyRevenue.reduce((a, b) => a + b, 0) / weeklyRevenue.length;

  // Calculate growth rate (last 4 weeks vs previous 4 weeks)
  const recentAvg =
    weeklyRevenue.slice(0, 4).reduce((a, b) => a + b, 0) / Math.min(4, weeklyRevenue.length);
  const olderAvg =
    weeklyRevenue.slice(4, 8).reduce((a, b) => a + b, 0) /
    Math.min(4, weeklyRevenue.slice(4, 8).length);
  const growthRate = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

  // Forecast
  const nextWeekForecast = recentAvg * (1 + growthRate);
  const nextMonthForecast = nextWeekForecast * 4;

  // Trends
  const trends: string[] = [];
  if (growthRate > 0.1)
    trends.push(`📈 Strong growth trend: ${(growthRate * 100).toFixed(1)}% increase`);
  else if (growthRate < -0.1)
    trends.push(`📉 Declining trend: ${(Math.abs(growthRate) * 100).toFixed(1)}% decrease`);
  else trends.push("📊 Stable revenue pattern");

  // Day of week analysis
  const dayRevenue = new Map<number, number[]>();
  orders.forEach((order) => {
    const day = new Date(order.created_at).getDay();
    if (!dayRevenue.has(day)) dayRevenue.set(day, []);
    dayRevenue.get(day)!.push(order.total_amount);

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayAvgs = Array.from(dayRevenue.entries())
    .map(([day, amounts]) => ({
      day,
      avg: amounts.reduce((a, b) => a + b, 0) / amounts.length,
    }))
    .sort((a, b) => b.avg - a.avg);

  if (dayAvgs.length > 0) {
    trends.push(`Best day: ${dayNames[dayAvgs[0].day]} (avg ${dayAvgs[0].avg.toFixed(2)})`);
    trends.push(
      `Slowest day: ${dayNames[dayAvgs[dayAvgs.length - 1].day]} (avg ${dayAvgs[dayAvgs.length - 1].avg.toFixed(2)})`
    );
  }

  // Recommendations
  const recommendations: string[] = [];
  if (growthRate > 0.15) {
    recommendations.push(
      "Strong growth! Consider expanding menu or increasing capacity to meet demand."
    );
  } else if (growthRate < -0.15) {
    recommendations.push(
      "Revenue declining. Review menu pricing, run promotions, or analyze customer feedback."
    );
  }

  if (dayAvgs.length > 1 && dayAvgs[0].avg / dayAvgs[dayAvgs.length - 1].avg > 2) {
    recommendations.push(
      `${dayNames[dayAvgs[dayAvgs.length - 1].day]} is significantly slower. Consider special promotions or reduced hours.`
    );
  }

  const currency = orders[0]?.currency || "GBP";
  const currencySymbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

  return {

    },
    trends,
    recommendations,
  };
}

/**
 * Calculate profit margins for menu items
 */
export async function calculateItemMargins(venueId: string): Promise<{

  }>;

}> {
  const supabase = await createClient();

  const { data: menuItems } = await supabase
    .from("menu_items")
    .select("name, price, category")
    .eq("venue_id", venueId)
    .eq("is_available", true);

  // Estimate costs based on category (rough approximation)
  const costEstimates: Record<string, number> = {
    Coffee: 0.3, // 30% of price

  };

  const items =
    menuItems?.map((item) => {
      const costRatio = costEstimates[item.category] || costEstimates.default;
      const estimatedCost = item.price * costRatio;
      const margin = item.price - estimatedCost;
      const marginPercent = (margin / item.price) * 100;

      return {

        estimatedCost,
        margin,
        marginPercent,
      };
    }) || [];

  // Sort by margin percent
  items.sort((a, b) => b.marginPercent - a.marginPercent);

  const avgMargin = items.reduce((sum, item) => sum + item.marginPercent, 0) / (items.length || 1);

  return {
    items,
    summary: `Average margin: ${avgMargin.toFixed(1)}%. Highest margin: ${items[0]?.name || "N/A"} (${items[0]?.marginPercent.toFixed(1)}%). Consider promoting high-margin items.`,
  };
}
