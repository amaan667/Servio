"use client";

import AnalyticsClient from "./AnalyticsClient";
import { PredictiveInsights } from "./components/PredictiveInsights";
import RoleBasedNavigation from "@/components/RoleBasedNavigation";
import type { UserRole } from "@/lib/permissions";
import Link from "next/link";
import { TIER_LIMITS } from "@/lib/tier-restrictions";

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
  hasAccess: boolean;
}

export default function AnalyticsClientPage({
  venueId,
  ordersData,
  menuData,
  revenueData,
  tier,
  role,
  hasAccess,
}: AnalyticsClientPageProps) {
  // Check if user has advanced analytics (Pro+ tier)
  const hasAdvanced = tier !== "starter" && TIER_LIMITS[tier]?.features.analytics !== "basic";

  // Show access denied if no access (shouldn't happen due to server-side check, but safety check)
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
          <RoleBasedNavigation
            venueId={venueId}
            userRole={role as UserRole}
            userName="User"
          />
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg mt-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You don't have permission to access analytics
                </p>
                <div className="mt-2">
                  <Link
                    href={`/dashboard/${venueId}/select-plan`}
                    className="text-sm font-medium text-yellow-800 underline"
                  >
                    Upgrade your plan to access this feature
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <RoleBasedNavigation
          venueId={venueId}
          userRole={role as UserRole}
          userName="User"
        />

        <div className="mb-8 mt-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics Dashboard</h1>
          <p className="text-lg text-foreground mt-2">
            {hasAdvanced
              ? "Track your business performance with advanced insights"
              : "Track your business performance and insights"}
          </p>
          {!hasAdvanced && tier === "starter" && (
            <div className="mt-2 text-sm text-gray-600">
              <Link
                href={`/dashboard/${venueId}/select-plan`}
                className="text-purple-600 hover:underline"
              >
                Upgrade to Pro for advanced analytics & AI insights
              </Link>
            </div>
          )}
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
