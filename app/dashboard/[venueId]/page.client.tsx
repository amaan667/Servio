"use client";

import React, { useEffect, useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, TrendingUp, ShoppingBag, Table } from "lucide-react";
import Link from "next/link";
import { useDashboardPrefetch } from "@/hooks/usePrefetch";
import { useConnectionMonitor } from "@/lib/connection-monitor";
import RoleManagementPopup from "@/components/role-management-popup";
import VenueSwitcherPopup from "@/components/venue-switcher-popup";
import { supabaseBrowser } from "@/lib/supabase";
import TrialStatusBanner from "@/components/TrialStatusBanner";
import { useAuthRedirect } from "./hooks/useAuthRedirect";

// Removed PullToRefresh - not needed, causes build issues

// Hooks
import {
  useDashboardData,
  type DashboardCounts,
  type DashboardStats,
} from "./hooks/useDashboardData";
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

  const { user: authUser, isLoading: authRedirectLoading } = useAuthRedirect();
  const [user, setUser] = useState<{ id: string } | null>(getCachedUser());
  const [venue, setVenue] = useState<Record<string, unknown> | null>(getCachedVenue());
  const [userRole, setUserRole] = useState<string | null>(getCachedRole());
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Show loading while checking auth redirect
  if (authRedirectLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no authenticated user (will redirect)
  if (!authUser) {
    return null;
  }

  // Sync authUser to local user state if needed
  useEffect(() => {
    if (authUser && !user) {
      setUser(authUser);
    }
  }, [authUser, user]);

  // Monitor connection status (must be at top before any returns)
  useConnectionMonitor();

  // Enable intelligent prefetching for dashboard routes
  useDashboardPrefetch(venueId);

  // Custom hooks for dashboard data and realtime (call before any returns)
  const venueTz = "Europe/London"; // Default timezone
  const dashboardData = useDashboardData(venueId, venueTz, venue, initialCounts, initialStats);

  useDashboardRealtime({
    venueId,
    todayWindow: dashboardData.todayWindow,
    refreshCounts: dashboardData.refreshCounts,
    loadStats: dashboardData.loadStats,
    updateRevenueIncrementally: dashboardData.updateRevenueIncrementally,
    venue: dashboardData.venue as { venue_id?: string } | null | undefined,
  });

  // Fetch live analytics data for charts
  const analyticsData = useAnalyticsData(venueId);

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
  // DON'T clear cache immediately - prevents flicker
  useEffect(() => {
    const handleFocus = () => {
      // Refresh data in background without clearing cache first
      // This prevents flicker by showing cached data while new data loads
      handleRefresh();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [venueId, handleRefresh]);

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
      console.log("[DASHBOARD AUTH] 🔍 Starting auth check", {
        venueId,
        hasCachedUser: !!user,
        hasCachedVenue: !!venue,
        hasCachedRole: !!userRole,
        authCheckComplete,
      });

      // ALWAYS fetch role if we don't have it, regardless of cache
      // This ensures fresh sign-ins get the correct role immediately
      if (userRole && authCheckComplete) {
        console.log("[DASHBOARD AUTH] ✅ Auth check already complete, skipping");
        // Only skip if we have role AND auth check is already complete
        return;
      }

      try {
        const supabase = supabaseBrowser();
        console.log("[DASHBOARD AUTH] 📡 Created Supabase client");

        // Try BOTH getSession() and getUser() to ensure we have valid auth
        let session = null;
        let sessionError = null;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          console.log(`[DASHBOARD AUTH] 🔄 Retry ${retries + 1}/${maxRetries}`);

          // Try getSession first
          const sessionResult = await supabase.auth.getSession();
          sessionError = sessionResult.error;
          session = sessionResult.data.session;

          console.log("[DASHBOARD AUTH] 📋 getSession result", {
            hasSession: !!session,
            hasUser: !!session?.user,
            userId: session?.user?.id,
            error: sessionError?.message,
          });

          // If getSession fails, try getUser() which makes a server request
          if (!session?.user) {
            console.log("[DASHBOARD AUTH] 🔄 No session, trying getUser()");
            const userResult = await supabase.auth.getUser();

            console.log("[DASHBOARD AUTH] 👤 getUser result", {
              hasUser: !!userResult.data?.user,
              userId: userResult.data?.user?.id,
              error: userResult.error?.message,
            });

            if (userResult.data?.user && !userResult.error) {
              // After getUser(), try getSession again
              const retrySession = await supabase.auth.getSession();
              session = retrySession.data.session;
              sessionError = retrySession.error;
              console.log("[DASHBOARD AUTH] 🔄 Retry getSession after getUser", {
                hasSession: !!session,
                hasUser: !!session?.user,
              });
            }
          }

          if (session?.user) {
            console.log("[DASHBOARD AUTH] ✅ Session found, breaking retry loop");
            break;
          }

          if (retries < maxRetries - 1) {
            console.log("[DASHBOARD AUTH] ⏳ Waiting 1s before retry");
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          retries++;
        }

        if (sessionError) {
          console.error("[DASHBOARD AUTH] ❌ SESSION ERROR:", {
            error: sessionError,
            message: sessionError.message,
            code: sessionError.code,
          });
          // NO REDIRECTS - User requested ZERO sign-in redirects
          // Just log and continue - might be a temporary error
          console.warn("[DASHBOARD AUTH] ⚠️ Session error but continuing (no redirect)");
        }

        if (!session?.user) {
          console.warn("[DASHBOARD AUTH] ⚠️ No session found after retries", {
            retries,
            maxRetries,
          });
          // NO REDIRECTS - User requested ZERO sign-in redirects
          // Use cached user if available
          if (user) {
            console.log("[DASHBOARD AUTH] ✅ Using cached user data");
          } else {
            console.warn("[DASHBOARD AUTH] ⚠️ No session and no cached user - continuing anyway");
          }
          // Don't return - continue with cached data or proceed without auth
        } else {
          console.log("[DASHBOARD AUTH] ✅ Setting user from session", {
            userId: session.user.id,
            email: session.user.email,
          });
          setUser(session.user);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`dashboard_user_${venueId}`, JSON.stringify(session.user));
          }
        }

        const userId = user?.id || session?.user?.id;
        console.log("[DASHBOARD AUTH] 🔍 Checking venue access", { userId, venueId });

        if (!userId) {
          console.warn("[DASHBOARD AUTH] ⚠️ No userId available - using cached venue if available");
          if (venue) {
            console.log("[DASHBOARD AUTH] ✅ Using cached venue data");
            setAuthCheckComplete(true);
          }
          return;
        }

        // Check if user is the venue owner
        console.log("[DASHBOARD AUTH] 📡 Querying venues table");
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .select("*")
          .eq("venue_id", venueId)
          .eq("owner_user_id", userId)
          .maybeSingle();

        console.log("[DASHBOARD AUTH] 📋 Venue query result", {
          hasVenueData: !!venueData,
          venueId: venueData?.venue_id,
          error: venueError?.message,
          errorCode: venueError?.code,
        });

        // If venue query fails with 406 or other errors, log but don't block
        if (venueError) {
          console.error("[DASHBOARD AUTH] ❌ VENUE QUERY ERROR:", {
            error: venueError,
            message: venueError.message,
            code: venueError.code,
          });
          // Don't redirect - might be a temporary Supabase issue
          // The user might still have access via staff role or cached data
        }

        const isOwner = !!venueData;

        // Check if user has a staff role for this venue
        console.log("[DASHBOARD AUTH] 📡 Querying user_venue_roles table");
        const { data: roleData, error: roleError } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("venue_id", venueId)
          .maybeSingle();

        console.log("[DASHBOARD AUTH] 📋 Role query result", {
          hasRoleData: !!roleData,
          role: roleData?.role,
          error: roleError?.message,
          errorCode: roleError?.code,
        });

        // If role query fails, log but don't block
        if (roleError) {
          console.error("[DASHBOARD AUTH] ❌ ROLE QUERY ERROR:", {
            error: roleError,
            message: roleError.message,
            code: roleError.code,
          });
        }

        const isStaff = !!roleData;

        console.log("[DASHBOARD AUTH] 📊 Access check summary", {
          isOwner,
          isStaff,
          hasVenueError: !!venueError,
          hasRoleError: !!roleError,
          hasCachedVenue: !!venue,
        });

        // NO REDIRECTS - User requested ZERO sign-in redirects
        // Always allow access - fail open approach
        if (!isOwner && !isStaff && !venueError && !roleError) {
          console.warn("[DASHBOARD AUTH] ⚠️ User has no access but continuing (no redirect)", {
            isOwner,
            isStaff,
            hasCachedVenue: !!venue,
          });
          // Use cached venue if available
          if (venue) {
            console.log("[DASHBOARD AUTH] ✅ Using cached venue data");
          }
        }

        // If queries failed but we have a cached venue, allow access
        if ((venueError || roleError) && venue) {
          console.warn("[DASHBOARD AUTH] ⚠️ Venue/role queries failed, using cached data");
        }

        // Set venue data and track the role that was set
        let finalRole: string | null = null;

        if (venueData) {
          setVenue(venueData);
          dashboardData.setVenue(venueData);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`dashboard_venue_${venueId}`, JSON.stringify(venueData));
          }
          setUserRole("owner");
          finalRole = "owner";
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`user_role_${venueId}`, "owner");
          }
        } else if (isStaff) {
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
            finalRole = role;
            if (typeof window !== "undefined") {
              sessionStorage.setItem(`user_role_${venueId}`, role);
            }
          }
        }

        // CRITICAL LOG: Role assignment result

        if (!finalRole) {
          console.error("❌❌❌ CRITICAL: Role not set after auth check!");
        }

        setAuthCheckComplete(true);
      } catch (_error) {
        console.error("❌ AUTH CHECK ERROR:", _error);
        setAuthCheckComplete(true);
      }
    }

    checkAuth()
      .then(() => {})
      .catch((err) => {
        console.error("❌ CLIENT: checkAuth() failed:", err);
      });
  }, [venueId]);

  // Log whenever userRole changes for dashboard rendering
  useEffect(() => {}, [userRole]);

  // NO AUTH REDIRECTS - User requested ZERO sign-in redirects
  // If there's truly no user data (after trying cache), just render anyway
  // Dashboard will handle gracefully

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
              <p className="text-sm font-medium text-red-900">Error Loading Dashboard</p>
              <p className="text-xs text-red-700">{dashboardData.error}</p>
            </div>
          </div>
        )}

        {/* Enhanced KPI Cards - Responsive Grid (Always 4 Cards) */}
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Card 1: Today's Orders */}
          <Link href={`/dashboard/${venueId}/live-orders?since=today`} className="block">
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
          </Link>

          {/* Card 2: Revenue */}
          <Link href={`/dashboard/${venueId}/analytics`} className="block">
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
          </Link>

          {/* Card 3: Tables Set Up */}
          <Link href={`/dashboard/${venueId}/tables`} className="block">
            <EnhancedStatCard
              title="Tables Set Up"
              value={dashboardData.counts.tables_set_up}
              icon={Table}
              iconColor="text-purple-600"
              iconBgColor="bg-purple-100"
              subtitle="all active"
              tooltip="Manage table setup and reservations"
              href={`/dashboard/${venueId}/tables`}
            />
          </Link>

          {/* Card 4: Menu Items */}
          <Link href={`/dashboard/${venueId}/menu-management`} className="block">
            <EnhancedStatCard
              title="Menu Items"
              value={dashboardData.stats.menuItems}
              icon={ShoppingBag}
              iconColor="text-orange-600"
              iconBgColor="bg-orange-100"
              subtitle="available"
              tooltip="Edit your menu items"
              href={`/dashboard/${venueId}/menu-management`}
            />
          </Link>
        </div>

        {/* AI Insights & Today at a Glance - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Insights - Left */}
          <AIInsights
            venueId={venueId}
            stats={{
              revenue: dashboardData.stats.revenue,
              menuItems: dashboardData.stats.menuItems,
              todayOrdersCount: dashboardData.counts.today_orders_count,
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
