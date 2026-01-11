"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Clock, AlertTriangle, Lightbulb } from "lucide-react";

interface Insight {
  type: "warning" | "opportunity" | "info";
  title: string;
  description: string;
  metric?: string;
  trend?: "up" | "down" | "neutral";
}

interface OrdersData {
  avgOrderValue?: number;
  totalOrders?: number;
  completedOrders?: number;
}

interface MenuData {
  topSellingItems?: Array<{
    price?: number;
    revenue?: number;
    name?: string;
  }>;
}

interface RevenueData {
  totalRevenue?: number;
  revenueByHour?: Array<{
    hour: string;
    revenue: number;
  }>;
  revenueByDay?: Record<string, number>;
}

interface PredictiveInsightsProps {
  ordersData: OrdersData;
  menuData: MenuData;
  revenueData: RevenueData;
}

export function PredictiveInsights({ ordersData, menuData, revenueData }: PredictiveInsightsProps) {
  const insights: Insight[] = [];

  // Calculate low-margin item performance
  const avgOrderValue = ordersData.avgOrderValue || 0;
  const lowMarginThreshold = avgOrderValue * 0.6;
  const lowMarginItems = menuData.topSellingItems?.filter(
    (item) => item.price && item.price < lowMarginThreshold
  );

  if (lowMarginItems && lowMarginItems.length > 0) {
    const lowMarginRevenue = lowMarginItems.reduce((sum: number, item) => {
      return sum + (item.revenue || 0);
    }, 0);
    const totalRevenue = revenueData.totalRevenue || 1;
    const percentage = ((lowMarginRevenue / totalRevenue) * 100).toFixed(1);

    insights.push({
      type: "warning",
      title: "Low-Margin Items Underperforming",
      description: `Your low-margin items contribute ${percentage}% of revenue but may be reducing overall profitability. Consider adjusting prices or promoting higher-margin items.`,
      metric: `-${percentage}%`,
      trend: "down",
    });
  }

  // Peak time analysis
  const revenueByHour = revenueData.revenueByHour || [];
  if (revenueByHour.length > 0) {
    const sortedHours = [...revenueByHour].sort((a, b) => b.revenue - a.revenue);
    const peakHour = sortedHours[0];

    if (peakHour && peakHour.hour) {
      insights.push({
        type: "info",
        title: "Peak Time Identified",
        description: `Your busiest hour is ${peakHour.hour}:00. Consider prepping ingredients 1-2 hours earlier and ensuring adequate staffing during this time.`,
        metric: `${peakHour.hour}:00`,
        trend: "neutral",
      });
    }
  }

  // Revenue trend analysis
  const revenueByDay = revenueData.revenueByDay || {};
  const dayEntries = Object.entries(revenueByDay);
  if (dayEntries.length >= 7) {
    const lastWeek = dayEntries.slice(-7);
    const prevWeek = dayEntries.slice(-14, -7);

    const lastWeekAvg = lastWeek.reduce((sum, [, rev]) => sum + (rev as number), 0) / 7;
    const prevWeekAvg = prevWeek.reduce((sum, [, rev]) => sum + (rev as number), 0) / 7;

    const change = ((lastWeekAvg - prevWeekAvg) / prevWeekAvg) * 100;

    if (change > 10) {
      insights.push({
        type: "opportunity",
        title: "Revenue Trending Upward",
        description: `Revenue increased by ${change.toFixed(1)}% this week. This trend suggests strong customer demand - consider expanding menu offerings or increasing inventory.`,
        metric: `+${change.toFixed(1)}%`,
        trend: "up",
      });
    } else if (change < -10) {
      insights.push({
        type: "warning",
        title: "Revenue Declining",
        description: `Revenue decreased by ${Math.abs(change).toFixed(1)}% this week. Consider promotional campaigns or reviewing menu prices and availability.`,
        metric: `${change.toFixed(1)}%`,
        trend: "down",
      });
    }
  }

  // Menu performance insights
  const topItems = menuData.topSellingItems || [];
  if (topItems.length >= 3) {
    const topThree = topItems.slice(0, 3);
    const topThreeRevenue = topThree.reduce((sum: number, item) => sum + (item.revenue || 0), 0);
    const totalRevenue = revenueData.totalRevenue || 1;
    const concentration = (topThreeRevenue / totalRevenue) * 100;

    if (concentration > 50) {
      insights.push({
        type: "warning",
        title: "Revenue Concentration Risk",
        description: `Your top 3 items account for ${concentration.toFixed(0)}% of revenue. Diversify your menu to reduce dependency on specific items.`,
        metric: `${concentration.toFixed(0)}%`,
        trend: "neutral",
      });
    }
  }

  // Order completion insights
  const totalOrders = ordersData.totalOrders || 0;
  const completedOrders = ordersData.completedOrders || 0;
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  if (completionRate < 90 && totalOrders > 10) {
    insights.push({
      type: "warning",
      title: "Order Completion Rate Below Target",
      description: `Only ${completionRate.toFixed(0)}% of orders are being completed. Review kitchen efficiency and identify bottlenecks.`,
      metric: `${completionRate.toFixed(0)}%`,
      trend: "down",
    });
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case "opportunity":
        return <Lightbulb className="h-5 w-5 text-green-500" />;
      default:
        return <TrendingUp className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTrendIcon = (trend?: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-blue-500" />;
  };

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Predictive Insights
          </CardTitle>
          <CardDescription>AI-powered business recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not enough data yet. Keep running your business and insights will appear here!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Predictive Insights
        </CardTitle>
        <CardDescription>AI-powered business recommendations based on your data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex gap-3 p-3 rounded-lg border bg-card">
            <div className="flex-shrink-0">{getIcon(insight.type)}</div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{insight.title}</h4>
                {insight.metric && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {getTrendIcon(insight.trend)}
                    {insight.metric}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{insight.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
