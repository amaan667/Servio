"use client";

import React, { useEffect, useMemo, useCallback, Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, TrendingUp, ShoppingBag, Table } from "lucide-react";
import Link from "next/link";
import { useDashboardPrefetch } from "@/hooks/usePrefetch";
import PullToRefresh from "@/components/PullToRefresh";
import { useConnectionMonitor } from "@/lib/connection-monitor";
import RoleManagementPopup from "@/components/role-management-popup";
import VenueSwitcherPopup from "@/components/venue-switcher-popup";
import { supabaseBrowser } from "@/lib/supabase";
import TrialStatusBanner from "@/components/TrialStatusBanner";

// Hooks
import { useDashboardData } from "./hooks/useDashboardData";
import { useDashboardRealtime } from "./hooks/useDashboardRealtime";
import { useAnalyticsData } from "./hooks/useAnalyticsData";

// New Modern Components
import { QuickActionsToolbar } from "./components/QuickActionsToolbar";
import { EnhancedStatCard } from "./components/EnhancedStatCard";
import { AIInsights } from "./components/AIInsights";
import { TodayAtAGlance } from "./components/TodayAtAGlance";
import { FeatureSections } from "./components/FeatureSections";

/**
 * Modern Venue Dashboard Client Component
 *
 * Features:
 * - Compact status banner (connection + trial + venue/role)
 * - Horizontal quick actions toolbar
 * - Enhanced KPI cards with trends and tooltips
 * - AI-powered insights
 * - Today at a Glance mini charts
 * - Grouped feature sections
 * - Optimized mobile responsive layout
 */

const DashboardClient = React.memo(function DashboardClient({ venueId }: { venueId: string }) {
  const router = useRouter();
  
  // Get cached user/venue data to prevent flicker
  const getCachedUser = () => {
    if (typeof window === 'undefined') return null;
    const cached = sessionStorage.getItem(`dashboard_user_${venueId}`);
    return cached ? JSON.parse(cached) : null;
  };

  const getCachedVenue = () => {
    if (typeof window === 'undefined') return null;
    const cached = sessionStorage.getItem(`dashboard_venue_${venueId}`);
    return cached ? JSON.parse(cached) : null;
  };

  // Get cached role to prevent flicker
  const getCachedRole = () => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(`user_role_${venueId}`);
  };

  const [user, setUser] = useState<{ id: string } | null>(getCachedUser());
  const [venue, setVenue] = useState<Record<string, unknown> | null>(getCachedVenue());
  const [userRole, setUserRole] = useState<string | null>(getCachedRole()); // Initialize with cached role
  const [loading, setLoading] = useState(false); // Start with false to prevent flicker
  const [authError, setAuthError] = useState<string | null>(null);

  // Monitor connection status (must be at top before any returns)
  useConnectionMonitor();

  // Enable intelligent prefetching for dashboard routes
  useDashboardPrefetch(venueId);

  // Custom hooks for dashboard data and realtime (call before any returns)
  const venueTz = "Europe/London"; // Default timezone
  const dashboardData = useDashboardData(venueId, venueTz, venue, undefined, undefined);

  useDashboardRealtime({
    venueId,
    todayWindow: dashboardData.todayWindow,
    refreshCounts: dashboardData.refreshCounts,
    loadStats: dashboardData.loadStats,
    updateRevenueIncrementally: dashboardData.updateRevenueIncrementally,
    venue: dashboardData.venue,
  });

  // Fetch live analytics data for charts
  const analyticsData = useAnalyticsData(venueId, venueTz);

  // Handle venue change
  const handleVenueChange = useCallback(
    (newVenueId: string) => {
      router.push(`/dashboard/${newVenueId}`);
    },
    [router]
  );

  const handleRefresh = useCallback(async () => {
    await dashboardData.refreshCounts();
    const venue = dashboardData.venue as { venue_id: string } | null;
    if (venue?.venue_id && dashboardData.todayWindow) {
      await dashboardData.loadStats(venue.venue_id, dashboardData.todayWindow);
    }
  }, [dashboardData]);

  // Auto-refresh when returning from checkout success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("upgrade") === "success") {
      setTimeout(() => {
        handleRefresh();
        const url = new URL(window.location.href);
        url.searchParams.delete("upgrade");
        window.history.replaceState({}, document.title, url.toString());
      }, 1000);
    }
  }, [handleRefresh]);

  // Use live analytics data or fallback to empty data
  const ordersByHour = useMemo(() => {
    if (analyticsData.data?.ordersByHour && analyticsData.data.ordersByHour.length > 0) {
      return analyticsData.data.ordersByHour;
    }
    // Fallback: return empty data for all hours
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      orders: 0,
    }));
  }, [analyticsData.data?.ordersByHour]);

  // Removed table utilization - can't calculate without knowing max table capacity
  const tableUtilization = 0; // Placeholder, not displayed

  const revenueByCategory = useMemo(() => {
    if (analyticsData.data?.revenueByCategory && analyticsData.data.revenueByCategory.length > 0) {
      return analyticsData.data.revenueByCategory;
    }
    return [];
  }, [analyticsData.data?.revenueByCategory]);

  // Check authentication and venue access
  useEffect(() => {
    async function checkAuth() {
      // Skip auth check if we already have cached data
      if (user && venue) {
        return;
      }
      
      try {
        const supabase = supabaseBrowser();

        // Get current user
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("[Dashboard] Session error:", sessionError);
          setAuthError("Authentication error");
          setLoading(false);
          return;
        }

        if (!session?.user) {
          setLoading(false);
          return;
        }

        setUser(session.user);
        // Cache user data
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(`dashboard_user_${venueId}`, JSON.stringify(session.user));
        }
        const userId = session.user.id;

        // Check if user is the venue owner
        const { data: venueData } = await supabase
          .from("venues")
          .select("*")
          .eq("venue_id", venueId)
          .eq("owner_user_id", userId)
          .maybeSingle();

        // Check if user has a staff role for this venue
        const { data: roleData } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("venue_id", venueId)
          .maybeSingle();

        const isOwner = !!venueData;
        const isStaff = !!roleData;

        // Auth check completed

        if (!isOwner && !isStaff) {
          setAuthError("You don't have access to this venue");
          setLoading(false);
          return;
        }

        // Set venue data
        if (venueData) {
          setVenue(venueData);
          dashboardData.setVenue(venueData);
          // Cache venue data
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(`dashboard_venue_${venueId}`, JSON.stringify(venueData));
          }
          setUserRole("owner");
          // Cache role to prevent flicker
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(`user_role_${venueId}`, "owner");
          }
        } else if (isStaff) {
          // Get venue details for staff
          const { data: staffVenue } = await supabase
            .from("venues")
            .select("*")
            .eq("venue_id", venueId)
            .single();

          if (staffVenue) {
            setVenue(staffVenue);
            dashboardData.setVenue(staffVenue);
            const role = roleData?.role || "staff";
            setUserRole(role);
            // Cache role to prevent flicker
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(`user_role_${venueId}`, role);
            }
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("[Dashboard] Auth check error:", error);
        setAuthError("Authentication failed");
        setLoading(false);
      }
    }

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  // NO AUTH REDIRECTS - User requested ZERO sign-in redirects
  // If there's truly no user data (after trying cache), just render anyway
  // Dashboard will handle gracefully

  // Render immediately with data (no loading states)

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-gray-50/50">
        {/* Trial Status Banner - Only for owners */}
        <TrialStatusBanner userRole={userRole} />

        {/* Quick Actions Toolbar */}
        <QuickActionsToolbar venueId={venueId} userRole={userRole} />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Error Alert */}
          {dashboardData.error && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-center gap-3 animate-in slide-in-from-top">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-sm font-bold">!</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Error Loading Dashboard</p>
                <p className="text-xs text-red-700">{dashboardData.error}</p>
              </div>
            </div>
          )}

          {/* Enhanced KPI Cards - Fixed Position Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Position 1: Today's Orders - Always visible */}
            <Link href={`/dashboard/${venueId}/live-orders?since=today`}>
              <EnhancedStatCard
                title="Today's Orders"
                value={dashboardData.counts.today_orders_count}
                icon={Clock}
                iconColor="text-blue-600"
                iconBgColor="bg-blue-100"
                trend={
                  analyticsData.data?.yesterdayComparison
                    ? {
                        value:
                          dashboardData.counts.today_orders_count -
                          analyticsData.data.yesterdayComparison.orders,
                        label: "vs yesterday",
                      }
                    : undefined
                }
                tooltip="View all orders placed today"
              />
            </Link>

            {/* Position 2: Revenue - Always rendered to maintain grid position */}
            {(userRole === "owner" || userRole === "manager") ? (
              <Link href={`/dashboard/${venueId}/analytics`}>
                <EnhancedStatCard
                  title="Revenue"
                  value={dashboardData.stats.revenue || 0}
                  icon={TrendingUp}
                  iconColor="text-green-600"
                  iconBgColor="bg-green-100"
                  isCurrency
                  trend={
                    analyticsData.data?.yesterdayComparison
                      ? {
                          value:
                            dashboardData.stats.revenue -
                            analyticsData.data.yesterdayComparison.revenue,
                          label: "vs yesterday",
                        }
                      : undefined
                  }
                  tooltip="View detailed revenue analytics"
                  />
                </Link>
              ) : (
                <div className="opacity-0 pointer-events-none select-none h-full" aria-hidden="true">
                  <EnhancedStatCard
                    title="Revenue"
                    value={0}
                    icon={TrendingUp}
                    iconColor="text-green-600"
                    iconBgColor="bg-green-100"
                    isCurrency
                  />
                </div>
              )}
            </div>

            {/* Position 3: Tables Set Up - Always visible */}
            <div className="min-h-[140px]">
              <Link href={`/dashboard/${venueId}/tables`} className="block h-full">
                <EnhancedStatCard
                title="Tables Set Up"
                value={dashboardData.counts.tables_set_up}
                icon={Table}
                iconColor="text-purple-600"
                iconBgColor="bg-purple-100"
                trend={{ value: 0, label: "all active" }}
                tooltip="Manage table setup and reservations"
                />
              </Link>
            </div>

            {/* Position 4: Menu Items - Always visible */}
            <div className="min-h-[140px]">
              <Link href={`/dashboard/${venueId}/menu-management`} className="block h-full">
                <EnhancedStatCard
                title="Menu Items"
                value={dashboardData.stats.menuItems}
                icon={ShoppingBag}
                iconColor="text-orange-600"
                iconBgColor="bg-orange-100"
                trend={{ value: 5, label: "available" }}
                tooltip="Edit your menu items"
                />
              </Link>
            </div>
          </div>
          </div>

          {/* AI Insights */}
          <AIInsights
            venueId={venueId}
            stats={{
              revenue: dashboardData.stats.revenue,
              menuItems: dashboardData.stats.menuItems,
              todayOrdersCount: dashboardData.counts.today_orders_count,
            }}
            topSellingItems={analyticsData.data?.topSellingItems}
            yesterdayComparison={analyticsData.data?.yesterdayComparison}
          />

          {/* Today at a Glance */}
          <TodayAtAGlance
            ordersByHour={ordersByHour}
            tableUtilization={tableUtilization}
            revenueByCategory={revenueByCategory}
            loading={false}
          />

          {/* Feature Sections */}
          <FeatureSections venueId={venueId} userRole={userRole} />
        </div>

        {/* Footer Modals */}
        <RoleManagementPopup />
        <VenueSwitcherPopup currentVenueId={venueId} onVenueChange={handleVenueChange} />
      </div>
    </PullToRefresh>
  );
});

export default DashboardClient;
