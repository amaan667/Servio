// Servio AI Assistant - Customer Insights Tools
// Feedback analysis, popular combos, customer patterns

import { createClient } from "@/lib/supabase";

interface FeedbackAnalysisResult {
  overallSentiment: "positive" | "neutral" | "negative";
  averageRating: number;
  totalFeedback: number;
  commonThemes: Array<{
    theme: string;
    count: number;
    sentiment: string;
  }>;
  recentComments: Array<{
    rating: number;
    comment: string;
    date: string;
  }>;
  recommendations: string[];
}

interface PopularCombosResult {
  combos: Array<{
    items: string[];
    frequency: number;
    totalRevenue: number;
    avgOrderValue: number;
    recommendation: string;
  }>;
  summary: string;
}

interface RepeatCustomerResult {
  repeatRate: number;
  topCustomers: Array<{
    phone: string;
    orderCount: number;
    totalSpent: number;
    avgOrderValue: number;
    lastVisit: string;
  }>;
  insights: string[];
}

interface DemandForecastResult {
  hourly: Array<{
    hour: number;
    timeRange: string;
    avgOrders: number;
    recommendation: string;
  }>;
  daily: Array<{
    dayOfWeek: string;
    avgOrders: number;
    peakHour: string;
  }>;
  summary: string;
}

/**
 * Analyze customer feedback for sentiment and insights
 */
export async function analyzeFeedback(venueId: string): Promise<FeedbackAnalysisResult> {
  const supabase = await createClient();

  // Get feedback from last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: feedback } = await supabase
    .from("feedback")
    .select("*")
    .eq("venue_id", venueId)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (!feedback || feedback.length === 0) {
    return {
      overallSentiment: "neutral",
      averageRating: 0,
      totalFeedback: 0,
      commonThemes: [],
      recentComments: [],
      recommendations: [
        "No customer feedback available yet. Encourage customers to leave reviews!",
      ],
    };
  }

  // Calculate average rating
  const ratings = feedback.filter((f) => f.rating != null).map((f) => f.rating);
  const averageRating =
    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  // Determine overall sentiment
  let overallSentiment: "positive" | "neutral" | "negative" = "neutral";
  if (averageRating >= 4) overallSentiment = "positive";
  else if (averageRating < 3) overallSentiment = "negative";

  // Analyze comments for themes (simple keyword matching)
  const themes = new Map<string, { count: number; sentiment: number }>();

  const positiveKeywords = [
    "great",
    "excellent",
    "amazing",
    "love",
    "perfect",
    "best",
    "fantastic",
    "delicious",
  ];
  const negativeKeywords = [
    "slow",
    "bad",
    "cold",
    "wrong",
    "terrible",
    "disappointing",
    "poor",
    "rude",
  ];
  const serviceKeywords = ["service", "staff", "waiter", "server", "friendly", "helpful"];
  const foodKeywords = ["food", "taste", "flavor", "fresh", "quality", "delicious", "bland"];
  const speedKeywords = ["fast", "quick", "slow", "wait", "waiting", "time"];

  feedback.forEach((f) => {
    if (!f.comments) return;
    const comment = f.comments.toLowerCase();

    // Service themes
    if (serviceKeywords.some((kw) => comment.includes(kw))) {
      const theme = themes.get("Service") || { count: 0, sentiment: 0 };
      theme.count++;
      theme.sentiment += f.rating || 3;
      themes.set("Service", theme);
    }

    // Food quality themes
    if (foodKeywords.some((kw) => comment.includes(kw))) {
      const theme = themes.get("Food Quality") || { count: 0, sentiment: 0 };
      theme.count++;
      theme.sentiment += f.rating || 3;
      themes.set("Food Quality", theme);
    }

    // Speed themes
    if (speedKeywords.some((kw) => comment.includes(kw))) {
      const theme = themes.get("Speed") || { count: 0, sentiment: 0 };
      theme.count++;
      theme.sentiment += f.rating || 3;
      themes.set("Speed", theme);
    }
  });

  const commonThemes = Array.from(themes.entries())
    .map(([theme, data]) => ({
      theme,
      count: data.count,
      sentiment:
        data.sentiment / data.count >= 4
          ? "positive"
          : data.sentiment / data.count < 3
            ? "negative"
            : "mixed",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Get recent comments
  const recentComments = feedback
    .filter((f) => f.comments && f.comments.length > 10)
    .slice(0, 5)
    .map((f) => ({
      rating: f.rating || 0,
      comment: f.comments || "",
      date: new Date(f.created_at).toLocaleDateString(),
    }));

  // Generate recommendations
  const recommendations: string[] = [];

  if (averageRating >= 4.5) {
    recommendations.push(
      "Excellent feedback! Share positive reviews on social media to attract new customers."
    );
  } else if (averageRating < 3) {
    recommendations.push(
      "Concerning feedback trends. Review common complaints and take immediate action."
    );
  }

  commonThemes.forEach((theme) => {
    if (theme.sentiment === "negative") {
      recommendations.push(
        `${theme.theme} receiving negative feedback (${theme.count} mentions). Priority area for improvement.`
      );
    } else if (theme.sentiment === "positive") {
      recommendations.push(
        `${theme.theme} is a strength (${theme.count} positive mentions). Continue to maintain high standards.`
      );
    }
  });

  return {
    overallSentiment,
    averageRating: Math.round(averageRating * 10) / 10,
    totalFeedback: feedback.length,
    commonThemes,
    recentComments,
    recommendations,
  };
}

/**
 * Identify popular item combinations for upselling
 */
export async function identifyPopularCombos(venueId: string): Promise<PopularCombosResult> {
  const supabase = await createClient();

  // Get last 60 days of orders
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const { data: orders } = await supabase
    .from("orders")
    .select("items, total_amount")
    .eq("venue_id", venueId)
    .gte("created_at", sixtyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  if (!orders || orders.length < 10) {
    return {
      combos: [],
      summary: "Not enough order data to identify popular combinations (need at least 10 orders).",
    };
  }

  // Find combos (2-item combinations)
  const comboMap = new Map<string, { count: number; revenue: number }>();

  orders.forEach((order) => {
    const items = (order.items as Array<{ item_name: string; quantity: number }>) || [];
    if (items.length < 2) return;

    // Get all pairs
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const combo = [items[i]!.item_name, items[j]!.item_name].sort().join(" + ");
        const existing = comboMap.get(combo) || { count: 0, revenue: 0 };
        existing.count++;
        existing.revenue += order.total_amount || 0;
        comboMap.set(combo, existing);
      }
    }
  });

  // Convert to array and filter (at least 3 occurrences)
  const combos = Array.from(comboMap.entries())
    .filter(([_, data]) => data.count >= 3)
    .map(([combo, data]) => {
      const items = combo.split(" + ");
      const avgOrderValue = data.revenue / data.count;

      let recommendation = "";
      if (data.count >= 10) {
        recommendation = `Very popular combo (${data.count} orders). Create a combo deal to encourage more sales.`;
      } else if (avgOrderValue > 15) {
        recommendation = `High-value combo (avg ${avgOrderValue.toFixed(2)}). Highlight this pairing to staff for upselling.`;
      } else {
        recommendation = `Moderate popularity. Consider bundling with a discount to increase frequency.`;
      }

      return {
        items,
        frequency: data.count,
        totalRevenue: Math.round(data.revenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        recommendation,
      };
    })
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const summary =
    combos.length > 0
      ? `Found ${combos.length} popular item combinations. Most frequent: "${combos[0]!.items.join(" + ")}" (${combos[0]!.frequency} orders).`
      : "No significant item combinations found. Single-item orders are most common.";

  return {
    combos,
    summary,
  };
}

/**
 * Track repeat customers and loyalty
 */
export async function analyzeRepeatCustomers(venueId: string): Promise<RepeatCustomerResult> {
  const supabase = await createClient();

  // Get last 90 days of orders
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: orders } = await supabase
    .from("orders")
    .select("customer_phone, customer_name, total_amount, created_at")
    .eq("venue_id", venueId)
    .gte("created_at", ninetyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")')
    .not("customer_phone", "is", null);

  if (!orders || orders.length === 0) {
    return {
      repeatRate: 0,
      topCustomers: [],
      insights: ["No customer data available. Ensure phone numbers are collected during orders."],
    };
  }

  // Group by phone number
  const customerMap = new Map<
    string,
    {
      name: string;
      orderCount: number;
      totalSpent: number;
      lastVisit: Date;
    }
  >();

  orders.forEach((order) => {
    const phone = order.customer_phone;
    const existing = customerMap.get(phone) || {
      name: order.customer_name || "Unknown",
      orderCount: 0,
      totalSpent: 0,
      lastVisit: new Date(order.created_at),
    };

    existing.orderCount++;
    existing.totalSpent += order.total_amount || 0;
    if (new Date(order.created_at) > existing.lastVisit) {
      existing.lastVisit = new Date(order.created_at);
    }

    customerMap.set(phone, existing);
  });

  // Calculate repeat rate
  const uniqueCustomers = customerMap.size;
  const repeatCustomers = Array.from(customerMap.values()).filter((c) => c.orderCount > 1).length;
  const repeatRate = (repeatCustomers / uniqueCustomers) * 100;

  // Top customers
  const topCustomers = Array.from(customerMap.entries())
    .map(([phone, data]) => ({
      phone: phone.slice(0, 4) + "***" + phone.slice(-3), // Anonymize
      orderCount: data.orderCount,
      totalSpent: Math.round(data.totalSpent * 100) / 100,
      avgOrderValue: Math.round((data.totalSpent / data.orderCount) * 100) / 100,
      lastVisit: data.lastVisit.toISOString().split("T")[0]!,
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10);

  // Generate insights
  const insights: string[] = [];

  if (repeatRate > 50) {
    insights.push(`Excellent customer loyalty! ${repeatRate.toFixed(0)}% of customers return.`);
  } else if (repeatRate < 20) {
    insights.push(
      `Low repeat rate (${repeatRate.toFixed(0)}%). Consider implementing a loyalty program.`
    );
  } else {
    insights.push(`Moderate repeat rate (${repeatRate.toFixed(0)}%). Room for improvement.`);
  }

  if (topCustomers.length > 0) {
    insights.push(
      `Top customer has ordered ${topCustomers[0]!.orderCount} times, spending ${topCustomers[0]!.totalSpent}. Reward loyal customers with exclusive offers.`
    );
  }

  const avgOrders = orders.length / uniqueCustomers;
  if (avgOrders < 1.5) {
    insights.push(
      `Most customers order only once. Focus on post-purchase engagement (follow-up messages, loyalty cards).`
    );
  }

  return {
    repeatRate: Math.round(repeatRate * 10) / 10,
    topCustomers,
    insights,
  };
}

/**
 * Forecast demand by time periods
 */
export async function forecastDemand(venueId: string): Promise<DemandForecastResult> {
  const supabase = await createClient();

  // Get last 60 days of orders
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const { data: orders } = await supabase
    .from("orders")
    .select("created_at")
    .eq("venue_id", venueId)
    .gte("created_at", sixtyDaysAgo.toISOString())
    .not("order_status", "in", '("CANCELLED","REFUNDED")');

  if (!orders || orders.length < 20) {
    return {
      hourly: [],
      daily: [],
      summary: "Not enough order data for demand forecasting (need at least 20 orders).",
    };
  }

  // Analyze by hour
  const hourlyDemand = new Map<number, number[]>();
  const dailyDemand = new Map<number, number[]>();

  orders.forEach((order) => {
    const date = new Date(order.created_at);
    const hour = date.getHours();
    const day = date.getDay();

    // Hourly
    if (!hourlyDemand.has(hour)) hourlyDemand.set(hour, []);
    hourlyDemand.get(hour)!.push(1);

    // Daily
    if (!dailyDemand.has(day)) dailyDemand.set(day, []);
    dailyDemand.get(day)!.push(1);
  });

  // Process hourly data
  const hourly = Array.from(hourlyDemand.entries())
    .map(([hour, counts]) => {
      const avgOrders = counts.length / 60; // Average per day over 60 days
      let recommendation = "";

      if (avgOrders > 5) {
        recommendation = "Peak hour - ensure full staffing and adequate prep.";
      } else if (avgOrders < 1) {
        recommendation = "Slow period - consider reduced staffing or promotional offers.";
      } else {
        recommendation = "Moderate demand - standard staffing sufficient.";
      }

      return {
        hour,
        timeRange: `${hour}:00-${hour + 1}:00`,
        avgOrders: Math.round(avgOrders * 10) / 10,
        recommendation,
      };
    })
    .sort((a, b) => a.hour - b.hour);

  // Process daily data
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daily = Array.from(dailyDemand.entries())
    .map(([day, counts]) => {
      const avgOrders = counts.length / 9; // Rough avg per week
      const dayHours = orders
        .filter((o) => new Date(o.created_at).getDay() === day)
        .map((o) => new Date(o.created_at).getHours());

      const hourCounts = new Map<number, number>();
      dayHours.forEach((h) => hourCounts.set(h, (hourCounts.get(h) || 0) + 1));
      const peakHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0];

      return {
        dayOfWeek: dayNames[day]!,
        avgOrders: Math.round(avgOrders * 10) / 10,
        peakHour: peakHour ? `${peakHour[0]}:00-${peakHour[0] + 1}:00` : "Unknown",
      };
    })
    .sort((a, b) => b.avgOrders - a.avgOrders);

  const busiestHour = hourly.length > 0 
    ? hourly.reduce((max, h) => (h.avgOrders > max.avgOrders ? h : max), hourly[0]!)
    : null;
  const busiestDay = daily[0];

  const summary = busiestDay && busiestHour
    ? `Peak demand: ${busiestDay.dayOfWeek} during ${busiestHour.timeRange} (avg ${busiestHour.avgOrders} orders/hour). Plan inventory and staffing accordingly.`
    : "Not enough data to determine peak demand patterns.";

  return {
    hourly,
    daily,
    summary,
  };
}
