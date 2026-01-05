"use client";

import React, { useEffect, useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, TrendingUp, ShoppingBag, Table } from "lucide-react";
import { useDashboardPrefetch } from "@/hooks/usePrefetch";
import { useConnectionMonitor } from "@/lib/connection-monitor";
// RoleManagementPopup and VenueSwitcherPopup removed - not used in this component
import TrialStatusBanner from "@/components/TrialStatusBanner";
import { useAuthRedirect } from "./hooks/useAuthRedirect";

// Removed PullToRefresh - not needed, causes build issues

// Hooks
import {
  useDashboardData,
  type DashboardCounts,
  type DashboardStats,
} from "./hooks/useDashboardData";
import { useAnalyticsData } from "./hooks/useAnalyticsData";

// New Modern Components
import { QuickActionsToolbar } from "./components/QuickActionsToolbar";
import { EnhancedStatCard } from "./components/EnhancedStatCard";
import { AIInsights } from "./components/AIInsights";
import { TodayAtAGlance } from "./components/TodayAtAGlance";
import { FeatureSections } from "./components/FeatureSections";

type DashboardLogLevel = "info" | "warn" | "error";

interface DashboardLogPayload {
  level: DashboardLogLevel;
  event: string;
  venueId: string;
  timestamp: string;
  details: Record<string, unknown>;
}

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

const DashboardClient = React.memo(function DashboardClient({
  venueId,
  initialCounts,
  initialStats,
}: {
  venueId: string;
  initialCounts?: DashboardCounts;
  initialStats?: DashboardStats;
}) {
  const router = useRouter();

  // Get cached user/venue data to prevent flicker
  const getCachedUser = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`dashboard_user_${venueId}`);
    return cached ? JSON.parse(cached) : null;
  };

  const getCachedVenue = () => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(`dashboard_venue_${venueId}`);
    return cached ? JSON.parse(cached) : null;
  };

  // Get cached role to prevent flicker
  const getCachedRole = () => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(`user_role_${venueId}`);
  };

  // Hooks must be called unconditionally - can't be in try-catch
  const { user: authUser, isLoading: authRedirectLoading } = useAuthRedirect();
  const [user, setUser] = useState<{ id: string } | null>(getCachedUser());
  const [venue, setVenue] = useState<Record<string, unknown> | null>(getCachedVenue());
  const [userRole, setUserRole] = useState<string | null>(getCachedRole());
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Sync authUser to local user state if needed
  useEffect(() => {
    if (authUser && !user) {
      setUser(authUser);
    }
  }, [authUser, user]);

  // Monitor connection status (must be at top before any returns)
  // Hooks must be called unconditionally
  useConnectionMonitor();

  // Enable intelligent prefetching for dashboard routes
  // Hooks must be called unconditionally
  useDashboardPrefetch(venueId);

  const sendDashboardLog = (_payload: DashboardLogPayload) => {
    // Dashboard logging disabled
    return;
  };

  // Custom hooks for dashboard data and realtime (call before any returns)
  const venueTz = "Europe/London"; // Default timezone

  // LOG: What server passed to client
  useEffect(() => {
    const timestamp = new Date().toISOString();
    const details = {
      timestamp: new Date().toISOString(),
      venueId,
      initialCounts: initialCounts
        ? {
            live_count: initialCounts.live_count,
            earlier_today_count: initialCounts.earlier_today_count,
            history_count: initialCounts.history_count,
            today_orders_count: initialCounts.today_orders_count,
            active_tables_count: initialCounts.active_tables_count,
            tables_set_up: initialCounts.tables_set_up,
            tables_in_use: initialCounts.tables_in_use,
            tables_reserved_now: initialCounts.tables_reserved_now,
          }
        : null,
      initialStats: initialStats
        ? {
            revenue: initialStats.revenue,
            menuItems: initialStats.menuItems,
            unpaid: initialStats.unpaid,
          }
        : null,
    };

    sendDashboardLog({
      level: "info",
      event: "initial_server_data",
      venueId,
      timestamp,
      details,
    });
  }, [venueId, initialCounts, initialStats]);

  // Hooks must be called unconditionally - can't be in try-catch
  const dashboardData = useDashboardData(venueId, venueTz, venue, initialCounts, initialStats);

  // Simple display values - use client state which is synced from server data
  // The useDashboardData hook ensures initialCounts/initialStats are used immediately
  const displayMenuItems = dashboardData.stats.menuItems;
  const displayTables = dashboardData.counts.tables_set_up;

  // LOG: What client is actually displaying
  useEffect(() => {
    const timestamp = new Date().toISOString();

    const displayedCounts = {
      live_count: dashboardData.counts.live_count,
      earlier_today_count: dashboardData.counts.earlier_today_count,
      history_count: dashboardData.counts.history_count,
      today_orders_count: dashboardData.counts.today_orders_count,
      active_tables_count: dashboardData.counts.active_tables_count,
      tables_set_up: dashboardData.counts.tables_set_up,
      tables_in_use: dashboardData.counts.tables_in_use,
      tables_reserved_now: dashboardData.counts.tables_reserved_now,
    };
    const displayedStats = {
      revenue: dashboardData.stats.revenue,
      menuItems: dashboardData.stats.menuItems,
      unpaid: dashboardData.stats.unpaid,
    };

    const details = {
      timestamp,
      venueId,
      counts: displayedCounts,
      stats: displayedStats,
      loading: dashboardData.loading,
    };

    sendDashboardLog({
      level: "info",
      event: "client_display_state",
      venueId,
      timestamp,
      details,
    });

    // COMPARISON: Check if displayed values match initial server values
    if (initialCounts && initialStats) {
      const countsMatch =
        JSON.stringify(displayedCounts) ===
        JSON.stringify({
          live_count: initialCounts.live_count,
          earlier_today_count: initialCounts.earlier_today_count,
          history_count: initialCounts.history_count,
          today_orders_count: initialCounts.today_orders_count,
          active_tables_count: initialCounts.active_tables_count,
          tables_set_up: initialCounts.tables_set_up,
          tables_in_use: initialCounts.tables_in_use,
          tables_reserved_now: initialCounts.tables_reserved_now,
        });
      const statsMatch =
        JSON.stringify(displayedStats) ===
        JSON.stringify({
          revenue: initialStats.revenue,
          menuItems: initialStats.menuItems,
          unpaid: initialStats.unpaid,
        });

      if (!countsMatch || !statsMatch) {
        const mismatchDetails = {
          timestamp,
          venueId,
          countsMatch,
          statsMatch,
          serverCounts: initialCounts,
          displayedCounts,
          serverStats: initialStats,
          displayedStats,
        };

        sendDashboardLog({
          level: "warn",
          event: "client_server_mismatch",
          venueId,
          timestamp,
          details: mismatchDetails,
        });
      } else {
        sendDashboardLog({
          level: "info",
          event: "client_server_match",
          venueId,
          timestamp,
          details: {
            timestamp,
            venueId,
          },
        });
      }
    }
  }, [
    venueId,
    dashboardData.counts,
    dashboardData.stats,
    dashboardData.loading,
    initialCounts,
    initialStats,
  ]);

  // Listen to custom events for instant updates when menu items or tables change
  useEffect(() => {
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    const handleMenuItemsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ venueId: string; count: number }>;
      const eventVenueId = customEvent.detail?.venueId;
      // Match both formats: venue-xxx and xxx
      if (
        eventVenueId === venueId ||
        eventVenueId === normalizedVenueId ||
        eventVenueId === venueId.replace("venue-", "") ||
        normalizedVenueId === eventVenueId.replace("venue-", "")
      ) {
        // Update menu items count immediately
        dashboardData.setStats((prev) => ({
          ...prev,
          menuItems: customEvent.detail.count,
        }));
      }
    };

    const handleTablesChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ venueId: string; count: number }>;
      const eventVenueId = customEvent.detail?.venueId;
      // Match both formats: venue-xxx and xxx
      if (
        eventVenueId === venueId ||
        eventVenueId === normalizedVenueId ||
        eventVenueId === venueId.replace("venue-", "") ||
        normalizedVenueId === eventVenueId.replace("venue-", "")
      ) {
        // Update tables count immediately
        dashboardData.setCounts((prev) => ({
          ...prev,
          tables_set_up: customEvent.detail.count,
          active_tables_count: customEvent.detail.count,
        }));
      }
    };

    window.addEventListener("menuItemsChanged", handleMenuItemsChanged);
    window.addEventListener("tablesChanged", handleTablesChanged);

    return () => {
      window.removeEventListener("menuItemsChanged", handleMenuItemsChanged);
      window.removeEventListener("tablesChanged", handleTablesChanged);
    };
  }, [venueId, dashboardData.setStats, dashboardData.setCounts]);

  // Fetch live analytics data for charts
  // Hooks must be called unconditionally
  const analyticsData = useAnalyticsData(venueId);

  // Log after hook completes
  useEffect(() => {}, [analyticsData]);

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
    // Only run on client side
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("upgrade") === "success") {
      setTimeout(() => {
        handleRefresh();
        const url = new URL(window.location.href);
        url.searchParams.delete("upgrade");
        window.history.replaceState(
          {
            /* Empty */
          },
          document.title,
          url.toString()
        );
      }, 1000);
    }
  }, [handleRefresh]);

  // Auto-refresh when user navigates back to dashboard
  // Always refresh on focus to ensure counts are up-to-date
  useEffect(() => {
    // Only run on client side to prevent SSR errors
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const handleFocus = () => {
      // Always refresh when page gains focus to ensure counts are accurate
      handleRefresh();
    };

    const handleVisibilityChange = () => {
      // Refresh when page becomes visible
      if (!document.hidden) {
        handleRefresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [venueId, handleRefresh]);

  // Periodic refresh as fallback (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
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
    const data = analyticsData.data?.revenueByCategory;
    if (data && Array.isArray(data) && data.length > 0) {
      return data;
    }
    return [];
  }, [analyticsData.data?.revenueByCategory]);

  // Auth check removed - server already did getAccessContext() RPC via requirePageAuth()
  // User comes from useAuthRedirect() hook which uses AuthProvider
  // Role/venue from cache or server data - no redundant client-side queries needed
  useEffect(() => {
    if (authUser && !user) {
      setUser(authUser);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`dashboard_user_${venueId}`, JSON.stringify(authUser));
      }
    }
    setAuthCheckComplete(true);
  }, [authUser, user, venueId]);

  // Log whenever userRole changes for dashboard rendering
  useEffect(() => {}, [userRole]);

  // CRITICAL: Render immediately - don't block on auth loading
  // Auth check happens in background, page renders with cached data
  // Never block - render immediately

  if (!authUser) {
    router.push("/sign-in");
    return (
      <div role="status" className="p-4 text-sm text-muted-foreground">
        Redirecting to sign-in...
      </div>
    );
  }

  // Render immediately - no blocking

  // Always render even if authUser isn't available yet.
  // Background auth check + cached data avoid blocking initial paint.

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Trial Status Banner - Only for owners */}
      <TrialStatusBanner userRole={userRole || undefined} />

      {/* Quick Actions Toolbar */}
      <QuickActionsToolbar
        venueId={venueId}
        userRole={userRole || undefined}
        onVenueChange={handleVenueChange}
      />

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
              <p className="text-sm font-medium text-red-900">Error loading data</p>
              <p className="text-xs text-red-700">{dashboardData.error}</p>
            </div>
          </div>
        )}

        {/* Enhanced KPI Cards - Responsive Grid (Always 4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Card 1: Today's Orders */}
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
                      ((dashboardData.counts.today_orders_count -
                        analyticsData.data.yesterdayComparison.orders) /
                        (analyticsData.data.yesterdayComparison.orders || 1)) *
                      100,
                    label: "vs yesterday",
                  }
                : undefined
            }
            tooltip="View all orders placed today"
            href={`/dashboard/${venueId}/live-orders?since=today`}
          />

          {/* Card 2: Revenue */}
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
                      ((dashboardData.stats.revenue -
                        analyticsData.data.yesterdayComparison.revenue) /
                        (analyticsData.data.yesterdayComparison.revenue || 1)) *
                      100,
                    label: "vs yesterday",
                  }
                : undefined
            }
            tooltip="View detailed revenue analytics"
            href={`/dashboard/${venueId}/analytics`}
          />

          {/* Card 3: Tables Set Up */}
          <EnhancedStatCard
            title="Tables Set Up"
            value={displayTables}
            icon={Table}
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
            subtitle="all active"
            tooltip="Manage table setup and reservations"
            href={`/dashboard/${venueId}/tables`}
          />

          {/* Card 4: Menu Items */}
          <EnhancedStatCard
            title="Menu Items"
            value={displayMenuItems}
            icon={ShoppingBag}
            iconColor="text-orange-600"
            iconBgColor="bg-orange-100"
            subtitle="available"
            tooltip="Edit your menu items"
            href={`/dashboard/${venueId}/menu-management`}
          />
        </div>

        {/* AI Insights & Today at a Glance - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Insights - Left */}
          <AIInsights
            venueId={venueId}
            stats={{
              revenue: dashboardData.stats.revenue || 0,
              // Always use server value if available, fallback to client state
              menuItems: initialStats?.menuItems ?? 0,
              todayOrdersCount: dashboardData.counts.today_orders_count || 0,
            }}
            topSellingItems={analyticsData.data?.topSellingItems}
            yesterdayComparison={analyticsData.data?.yesterdayComparison}
            userRole={userRole || undefined}
          />

          {/* Today at a Glance - Right */}
          <TodayAtAGlance
            ordersByHour={ordersByHour}
            tableUtilization={tableUtilization}
            revenueByCategory={revenueByCategory}
            loading={false}
          />
        </div>

        {/* Feature Sections */}
        <FeatureSections venueId={venueId} userRole={userRole || undefined} />
      </div>

      {/* Removed Footer Modals - moved to QuickActionsToolbar */}
    </div>
  );
});

export default DashboardClient;
