"use client";

import AnalyticsClient from "./AnalyticsClient";
import { PredictiveInsights } from "./components/PredictiveInsights";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import Link from "next/link";
import { hasAdvancedAnalyticsByTier, getAnalyticsTierLabel } from "@/lib/tier-limits";
import { Badge } from "@/components/ui/badge";

interface TopSellingItem {
  name: string;
  quantity: number;
  revenue: number;
  category?: string;
  ordersCount?: number;
  price?: number;
}

interface AnalyticsClientPageProps {
  venueId: string;
  ordersData: {
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    avgOrderValue: number;
    ordersByStatus: Record<string, number>;
    ordersByDay: Record<string, number>;
    recentOrders: unknown[];
  };
  menuData: {
    totalItems: number;
    activeItems: number;
    topSellingItems: TopSellingItem[];
    itemsWithImages: number;
    itemsByCategory: Record<string, number>;
  };
  revenueData: {
    totalRevenue: number;
    averageOrderValue: number;
    revenueByHour: Array<{ hour: string; revenue: number }>;
    revenueByDay: Record<string, number>;
  };
  tier: string;
  role: string;
}

export default function AnalyticsClientPage({
  venueId,
  ordersData,
  menuData,
  revenueData,
  tier,
  role,
}: AnalyticsClientPageProps) {
  // Check if user has advanced analytics (Pro+ tier) using centralized helper
  const hasAdvanced = hasAdvancedAnalyticsByTier(tier);
  const analyticsTier = getAnalyticsTierLabel(tier);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation venueId={venueId} userRole={role as UserRole} userName="User" />

        <div className="mb-8 mt-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics Dashboard</h1>
            <p className="text-lg text-foreground mt-2">
              {analyticsTier === "basic" && "Track your business performance and insights"}
              {analyticsTier === "advanced" && "Track your business performance with advanced insights & exports"}
              {analyticsTier === "enterprise" && "Track your business performance with enterprise analytics suite & financial exports"}
            </p>
            {analyticsTier === "basic" && (
              <div className="mt-2 text-sm text-gray-600">
                <Link
                  href={`/select-plan?change=true`}
                  className="text-purple-600 hover:underline"
                >
                  Upgrade to Pro for advanced analytics & AI insights
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {analyticsTier === "basic" && (
              <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                Basic Analytics
              </Badge>
            )}
            {analyticsTier === "advanced" && (
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                Advanced Analytics
              </Badge>
            )}
            {analyticsTier === "enterprise" && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                Enterprise Analytics
              </Badge>
            )}
          </div>
        </div>

        {/* Predictive AI Insights - Pro+ only */}
        {hasAdvanced && (
          <div className="mb-6">
            <PredictiveInsights
              ordersData={ordersData}
              menuData={menuData}
              revenueData={revenueData}
            />
          </div>
        )}

        <AnalyticsClient
          ordersData={ordersData}
          menuData={menuData}
          revenueData={revenueData}
          hasAdvancedAnalytics={hasAdvanced}
          currentTier={tier}
          venueId={venueId}
        />
      </div>
    </div>
  );
}
