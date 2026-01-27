"use client";

import React from "react";
import { Sparkles, TrendingUp, AlertCircle, Brain } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Insight {
  type: "success" | "warning" | "info";
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
}

interface AIInsightsProps {
  venueId: string;
  stats: {
    revenue: number;
    menuItems: number;
    todayOrdersCount: number;
  };
  topSellingItems?: Array<{ name: string; price: number; count: number }>;
  yesterdayComparison?: {
    orders: number;
    revenue: number;
  };
  userRole?: string | null;
}

export function AIInsights({
  venueId,
  stats,
  topSellingItems,
  yesterdayComparison,
  userRole,
}: AIInsightsProps) {
  const insights: Insight[] = [];

  // Generate insights based on data
  // Only show "No Orders Yet" if BOTH order count is 0 AND revenue is 0 (double check)
  // AND there are no top selling items (triple check)
  const hasRealOrders = stats.revenue > 0 || (topSellingItems && topSellingItems.length > 0);

  if (stats.todayOrdersCount === 0 && !hasRealOrders) {
    insights.push({
      type: "warning",
      title: "No Orders Yet Today",
      message: "Consider testing your QR flow or promoting your menu to customers.",
      action: {
        label: "View QR Codes",
        href: `/dashboard/${venueId}/qr-codes`,
      },
    });
  }

  // Top selling item insight
  if (topSellingItems && topSellingItems.length > 0) {
    const topItem = topSellingItems[0];
    if (topItem) {
      const timesText = topItem.count === 1 ? "time" : "times";
      insights.push({
        type: "success",
        title: "Top Seller",
        message: `"${topItem.name}" (£${topItem.price.toFixed(2)}) has been added to cart ${topItem.count} ${timesText} today. Consider promoting it!`,
        action: {
          label: "Edit Menu",
          href: `/dashboard/${venueId}/menu-management`,
        },
      });
    }
  }

  // Yesterday comparison insights
  if (yesterdayComparison) {
    const orderChange =
      ((stats.todayOrdersCount - yesterdayComparison.orders) / (yesterdayComparison.orders || 1)) *
      100;
    const revenueChange =
      ((stats.revenue - yesterdayComparison.revenue) / (yesterdayComparison.revenue || 1)) * 100;

    if (orderChange > 20) {
      insights.push({
        type: "success",
        title: "Strong Growth",
        message: `Orders are up ${Math.round(orderChange)}% compared to yesterday (same time period). Keep up the momentum!`,
        action: {
          label: "View Analytics",
          href: `/dashboard/${venueId}/analytics`,
        },
      });
    } else if (orderChange < -20) {
      insights.push({
        type: "warning",
        title: "Orders Down",
        message: `Orders are down ${Math.round(Math.abs(orderChange))}% compared to yesterday (same time period). Consider promotions or check your QR codes.`,
        action: {
          label: "View QR Codes",
          href: `/dashboard/${venueId}/qr-codes`,
        },
      });
    }

    // Only show revenue insights for owners/managers
    if ((userRole === "owner" || userRole === "manager") && revenueChange > 15) {
      insights.push({
        type: "success",
        title: "Revenue Boost",
        message: `Revenue is up ${Math.round(revenueChange)}% compared to yesterday (same time period). Excellent work!`,
        action: {
          label: "View Analytics",
          href: `/dashboard/${venueId}/analytics`,
        },
      });
    }
  }

  // Average order value insight - Only for owners/managers
  if (
    (userRole === "owner" || userRole === "manager") &&
    stats.revenue > 0 &&
    stats.todayOrdersCount > 0
  ) {
    const avgOrderValue = stats.revenue / stats.todayOrdersCount;
    if (avgOrderValue < 10) {
      insights.push({
        type: "info",
        title: "Low Average Order Value",
        message: `Your average order value is £${avgOrderValue.toFixed(2)}. Consider upselling or adding combo deals to increase revenue.`,
        action: {
          label: "View Analytics",
          href: `/dashboard/${venueId}/analytics`,
        },
      });
    } else if (avgOrderValue > 20) {
      insights.push({
        type: "success",
        title: "High Order Value",
        message: `Your average order value of £${avgOrderValue.toFixed(2)} is excellent! Keep up the great work.`,
      });
    }
  }

  // Menu items insight
  if (stats.menuItems < 5) {
    insights.push({
      type: "info",
      title: "Expand Your Menu",
      message: `You have ${stats.menuItems} items on your menu. Consider adding more variety to attract more customers.`,
      action: {
        label: "Add Menu Items",
        href: `/dashboard/${venueId}/menu-management`,
      },
    });
  }

  // Always show at least a default helpful card
  if (insights.length === 0) {
    insights.push({
      type: "info",
      title: "Welcome to Your Dashboard",
      message:
        "Your AI-powered insights will appear here as you start receiving orders and grow your business.",
      action: {
        label: "Get Started",
        href: `/dashboard/${venueId}/qr-codes`,
      },
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Insights</h3>
      </div>
      {insights.slice(0, 3).map((insight, index) => (
        <Card
          key={index}
          className="border-l-4 border-l-blue-500 dark:border-l-blue-400 shadow-sm hover:shadow-md transition-all duration-200 animate-in fade-in bg-white dark:bg-gray-800 dark:border-gray-700"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg flex-shrink-0 ${
                  insight.type === "success"
                    ? "bg-green-100 dark:bg-green-900/30"
                    : insight.type === "warning"
                      ? "bg-orange-100 dark:bg-orange-900/30"
                      : "bg-blue-100 dark:bg-blue-900/30"
                }`}
              >
                {insight.type === "success" ? (
                  <TrendingUp
                    className={`h-4 w-4 ${
                      insight.type === "success"
                        ? "text-green-600 dark:text-green-400"
                        : insight.type === "warning"
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-blue-600 dark:text-blue-400"
                    }`}
                  />
                ) : insight.type === "warning" ? (
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                ) : (
                  <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
                    {insight.title}
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-xs flex items-center gap-1 dark:border-gray-600 dark:text-gray-300"
                  >
                    <Brain className="h-3 w-3" />
                    AI Insight
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{insight.message}</p>

                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-2 transition-colors"
                  >
                    {insight.action.label}
                    <span>→</span>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {insights.length > 3 && (
        <div className="text-center pt-2">
          <Link
            href={`/dashboard/${venueId}/analytics`}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            View More Insights
            <span>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
