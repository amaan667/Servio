"use client";

import React, { useEffect, useMemo, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, TrendingUp, ShoppingBag, Table } from "lucide-react";
import Link from "next/link";
import { useDashboardPrefetch } from "@/hooks/usePrefetch";
import { useConnectionMonitor } from "@/lib/connection-monitor";
// RoleManagementPopup and VenueSwitcherPopup removed - not used in this component
import { supabaseBrowser } from "@/lib/supabase";
import TrialStatusBanner from "@/components/TrialStatusBanner";
import { useAuthRedirect } from "./hooks/useAuthRedirect";
import { isCacheFresh } from "@/lib/cache/count-cache";

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
  // IMMEDIATE LOG - runs on every render, before any hooks
  // Use console.error - ALWAYS visible in browser console
  const serverMenuItems = initialStats?.menuItems || 0;
  const serverRevenue = initialStats?.revenue || 0;
  const serverTables = initialCounts?.tables_set_up || 0;
  const serverOrders = initialCounts?.today_orders_count || 0;
  
  // CRITICAL: Log immediately - cannot be skipped
  console.error("═══════════════════════════════════════════════════════════");
  console.error("🚨 [DASHBOARD CLIENT] Component Rendered - WHAT FRONTEND RECEIVES");
  console.error("═══════════════════════════════════════════════════════════");
  console.error("Venue ID:", venueId);
  console.error("📥 RECEIVED FROM SERVER (initialStats):");
  console.error("  menuItems:", serverMenuItems);
  console.error("  revenue: £", serverRevenue.toFixed(2));
  console.error("  unpaid:", initialStats?.unpaid || 0);
  console.error("📥 RECEIVED FROM SERVER (initialCounts):");
  console.error("  today_orders_count:", serverOrders);
  console.error("  tables_set_up:", serverTables);
  console.error("  live_count:", initialCounts?.live_count || 0);
  console.error("═══════════════════════════════════════════════════════════");
  
  // Single line summary for easy spotting
  console.error(`[FRONTEND RECEIVED] Menu: ${serverMenuItems} | Tables: ${serverTables} | Revenue: £${serverRevenue.toFixed(2)} | Orders: ${serverOrders}`);
  
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

  // CRITICAL LOG: Dashboard page loaded with initial stats
  // Log immediately on component mount
  useEffect(() => {
    // Get all values for comparison
    const serverMenuItems = initialStats?.menuItems || 0;
    const serverRevenue = initialStats?.revenue || 0;
    const serverTables = initialCounts?.tables_set_up || 0;
    const serverOrders = initialCounts?.today_orders_count || 0;
    
    const clientMenuItems = dashboardData.stats.menuItems;
    const clientRevenue = dashboardData.stats.revenue;
    const clientTables = dashboardData.counts.tables_set_up;
    const clientOrders = dashboardData.counts.today_orders_count;
    
    // What's actually displayed (using fallback logic)
    const displayedMenuItems = initialStats?.menuItems ?? clientMenuItems ?? 0;
    const displayedRevenue = clientRevenue || 0;
    const displayedTables = initialCounts?.tables_set_up ?? clientTables ?? 0;
    const displayedOrders = clientOrders || 0;
    
    // DETAILED LOG: Show exactly what's being displayed
    console.error("═══════════════════════════════════════════════════════════");
    console.error("📊 [DASHBOARD CLIENT] useEffect - COMPLETE COUNT ANALYSIS");
    console.error("═══════════════════════════════════════════════════════════");
    console.error("Venue ID:", venueId);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("📥 RECEIVED FROM SERVER:");
    console.error("  initialStats.menuItems:", serverMenuItems);
    console.error("  initialStats.revenue: £", serverRevenue.toFixed(2));
    console.error("  initialCounts.tables_set_up:", serverTables);
    console.error("  initialCounts.today_orders_count:", serverOrders);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("📊 CLIENT STATE (dashboardData):");
    console.error("  stats.menuItems:", clientMenuItems);
    console.error("  stats.revenue: £", clientRevenue.toFixed(2));
    console.error("  counts.tables_set_up:", clientTables);
    console.error("  counts.today_orders_count:", clientOrders);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("🖥️  DISPLAYED VALUES (what user sees):");
    console.error("  Menu Items card:", displayedMenuItems);
    console.error("  Revenue card: £", displayedRevenue.toFixed(2));
    console.error("  Tables Set Up card:", displayedTables);
    console.error("  Today's Orders card:", displayedOrders);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("✅ COMPARISON:");
    console.error("  Menu Items - Server:", serverMenuItems, "| Client:", clientMenuItems, "| Displayed:", displayedMenuItems, serverMenuItems === displayedMenuItems ? "✅" : "❌");
    console.error("  Revenue - Server: £", serverRevenue.toFixed(2), "| Client: £", clientRevenue.toFixed(2), "| Displayed: £", displayedRevenue.toFixed(2), serverRevenue === displayedRevenue ? "✅" : "❌");
    console.error("  Tables - Server:", serverTables, "| Client:", clientTables, "| Displayed:", displayedTables, serverTables === displayedTables ? "✅" : "❌");
    console.error("  Orders - Server:", serverOrders, "| Client:", clientOrders, "| Displayed:", displayedOrders, serverOrders === displayedOrders ? "✅" : "❌");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("Timestamp:", new Date().toISOString());
    console.error("═══════════════════════════════════════════════════════════");
    
    // Check for mismatches
    const menuItemsMatch = serverMenuItems === displayedMenuItems;
    const revenueMatch = Math.abs(serverRevenue - displayedRevenue) < 0.01;
    const tablesMatch = serverTables === displayedTables;
    const ordersMatch = serverOrders === displayedOrders;
    
    if (!menuItemsMatch || !revenueMatch || !tablesMatch || !ordersMatch) {
      console.error("❌ MISMATCHES DETECTED!");
      if (!menuItemsMatch) console.error("  Menu Items: Server", serverMenuItems, "≠ Displayed", displayedMenuItems);
      if (!revenueMatch) console.error("  Revenue: Server £", serverRevenue.toFixed(2), "≠ Displayed £", displayedRevenue.toFixed(2));
      if (!tablesMatch) console.error("  Tables: Server", serverTables, "≠ Displayed", displayedTables);
      if (!ordersMatch) console.error("  Orders: Server", serverOrders, "≠ Displayed", displayedOrders);
    }
    
    // Also log as plain console.log for easy filtering
    console.log("DASHBOARD COUNTS SUMMARY:", {
      menuItems: { server: serverMenuItems, client: clientMenuItems, displayed: displayedMenuItems },
      revenue: { server: serverRevenue, client: clientRevenue, displayed: displayedRevenue },
      tables: { server: serverTables, client: clientTables, displayed: displayedTables },
      orders: { server: serverOrders, client: clientOrders, displayed: displayedOrders },
      venueId,
    });
  }, [venueId, initialStats?.menuItems, initialStats?.revenue, initialCounts?.tables_set_up, initialCounts?.today_orders_count, dashboardData.stats.menuItems, dashboardData.stats.revenue, dashboardData.counts.tables_set_up, dashboardData.counts.today_orders_count]);

  // Fetch ACTUAL database counts and compare with what was sent
  useEffect(() => {
    const fetchActualCounts = async () => {
      try {
        const supabase = supabaseBrowser();
        const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
        const venueTz = "Europe/London";
        
        // Fetch actual counts from database
        const { data: actualCountsData, error: countsError } = await supabase
          .rpc("dashboard_counts", {
            p_venue_id: normalizedVenueId,
            p_tz: venueTz,
            p_live_window_mins: 30,
          })
          .single();

        // Fetch actual menu items count
        const { fetchMenuItemCount } = await import("@/lib/counts/unified-counts");
        const actualMenuItems = await fetchMenuItemCount(venueId);

        // Fetch actual tables count
        const { data: allTables } = await supabase
          .from("tables")
          .select("id, is_active")
          .eq("venue_id", normalizedVenueId);
        const actualTablesSetUp = allTables?.filter((t) => t.is_active).length || 0;

        // Fetch actual revenue
        const { todayWindowForTZ } = await import("@/lib/time");
        const window = todayWindowForTZ(venueTz);
        const { data: orders } = await supabase
          .from("orders")
          .select("total_amount, order_status, payment_status")
          .eq("venue_id", normalizedVenueId)
          .gte("created_at", window.startUtcISO)
          .lt("created_at", window.endUtcISO)
          .neq("order_status", "CANCELLED")
          .neq("order_status", "REFUNDED");
        const actualRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

        // Extract actual counts from RPC response
        const actualCounts = actualCountsData as DashboardCounts | null;
        const actualTodayOrders = actualCounts?.today_orders_count || 0;
        const actualLiveOrders = actualCounts?.live_count || 0;
        const actualEarlierToday = actualCounts?.earlier_today_count || 0;
        const actualHistory = actualCounts?.history_count || 0;
        const actualActiveTables = actualCounts?.active_tables_count || 0;
        const actualTablesInUse = actualCounts?.tables_in_use || 0;
        const actualTablesReserved = actualCounts?.tables_reserved_now || 0;

        // Fetch actual table counts directly
        const { data: activeSessions } = await supabase
          .from("table_sessions")
          .select("id")
          .eq("venue_id", normalizedVenueId)
          .eq("status", "OCCUPIED")
          .is("closed_at", null);
        const actualTablesInUseDirect = activeSessions?.length || 0;

        const now = new Date();
        const { data: currentReservations } = await supabase
          .from("reservations")
          .select("id")
          .eq("venue_id", normalizedVenueId)
          .eq("status", "BOOKED")
          .lte("start_at", now.toISOString())
          .gte("end_at", now.toISOString());
        const actualTablesReservedDirect = currentReservations?.length || 0;

        // What was sent from server
        const sentMenuItems = initialStats?.menuItems || 0;
        const sentRevenue = initialStats?.revenue || 0;
        const sentUnpaid = initialStats?.unpaid || 0;
        const sentTables = initialCounts?.tables_set_up || 0;
        const sentTodayOrders = initialCounts?.today_orders_count || 0;
        const sentLiveOrders = initialCounts?.live_count || 0;
        const sentEarlierToday = initialCounts?.earlier_today_count || 0;
        const sentHistory = initialCounts?.history_count || 0;
        const sentActiveTables = initialCounts?.active_tables_count || 0;
        const sentTablesInUse = initialCounts?.tables_in_use || 0;
        const sentTablesReserved = initialCounts?.tables_reserved_now || 0;

        // Log comprehensive comparison
        console.log("═══════════════════════════════════════════════════════════");
        console.log("🔍 [DASHBOARD] ACTUAL DATABASE COUNTS vs SENT COUNTS");
        console.log("═══════════════════════════════════════════════════════════");
        console.log("Venue ID:", venueId);
        console.log("Normalized Venue ID:", normalizedVenueId);
        console.log("Timestamp:", new Date().toISOString());
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📤 SENT FROM SERVER (initialCounts/initialStats):");
        console.log("  Menu Items:", sentMenuItems);
        console.log("  Revenue: £", sentRevenue.toFixed(2));
        console.log("  Unpaid Orders:", sentUnpaid);
        console.log("  Tables Set Up:", sentTables);
        console.log("  Active Tables Count:", sentActiveTables);
        console.log("  Tables In Use:", sentTablesInUse);
        console.log("  Tables Reserved Now:", sentTablesReserved);
        console.log("  Today's Orders:", sentTodayOrders);
        console.log("  Live Orders:", sentLiveOrders);
        console.log("  Earlier Today:", sentEarlierToday);
        console.log("  History:", sentHistory);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("💾 ACTUAL DATABASE COUNTS (just fetched):");
        console.log("  Menu Items:", actualMenuItems);
        console.log("  Revenue: £", actualRevenue.toFixed(2));
        console.log("  Tables Set Up:", actualTablesSetUp);
        console.log("  Active Tables Count:", actualActiveTables);
        console.log("  Tables In Use (RPC):", actualTablesInUse);
        console.log("  Tables In Use (Direct):", actualTablesInUseDirect);
        console.log("  Tables Reserved Now (RPC):", actualTablesReserved);
        console.log("  Tables Reserved Now (Direct):", actualTablesReservedDirect);
        console.log("  Today's Orders:", actualTodayOrders);
        console.log("  Live Orders:", actualLiveOrders);
        console.log("  Earlier Today:", actualEarlierToday);
        console.log("  History:", actualHistory);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🔎 COMPARISON (Sent vs Actual):");
        console.log("  Menu Items:", sentMenuItems, "vs", actualMenuItems, sentMenuItems === actualMenuItems ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Revenue: £", sentRevenue.toFixed(2), "vs £", actualRevenue.toFixed(2), Math.abs(sentRevenue - actualRevenue) < 0.01 ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Tables Set Up:", sentTables, "vs", actualTablesSetUp, sentTables === actualTablesSetUp ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Active Tables Count:", sentActiveTables, "vs", actualActiveTables, sentActiveTables === actualActiveTables ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Tables In Use:", sentTablesInUse, "vs", actualTablesInUseDirect, sentTablesInUse === actualTablesInUseDirect ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Tables Reserved Now:", sentTablesReserved, "vs", actualTablesReservedDirect, sentTablesReserved === actualTablesReservedDirect ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Today's Orders:", sentTodayOrders, "vs", actualTodayOrders, sentTodayOrders === actualTodayOrders ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Live Orders:", sentLiveOrders, "vs", actualLiveOrders, sentLiveOrders === actualLiveOrders ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  Earlier Today:", sentEarlierToday, "vs", actualEarlierToday, sentEarlierToday === actualEarlierToday ? "✅ MATCH" : "❌ MISMATCH");
        console.log("  History:", sentHistory, "vs", actualHistory, sentHistory === actualHistory ? "✅ MATCH" : "❌ MISMATCH");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        // Check for any mismatches
        const hasMismatches = 
          sentMenuItems !== actualMenuItems ||
          Math.abs(sentRevenue - actualRevenue) >= 0.01 ||
          sentTables !== actualTablesSetUp ||
          sentActiveTables !== actualActiveTables ||
          sentTablesInUse !== actualTablesInUseDirect ||
          sentTablesReserved !== actualTablesReservedDirect ||
          sentTodayOrders !== actualTodayOrders ||
          sentLiveOrders !== actualLiveOrders ||
          sentEarlierToday !== actualEarlierToday ||
          sentHistory !== actualHistory;

        if (hasMismatches) {
          console.error("❌ MISMATCHES DETECTED BETWEEN SENT AND ACTUAL COUNTS!");
          if (sentMenuItems !== actualMenuItems) {
            console.error(`  Menu Items: Sent ${sentMenuItems} but actual is ${actualMenuItems} (diff: ${actualMenuItems - sentMenuItems})`);
          }
          if (Math.abs(sentRevenue - actualRevenue) >= 0.01) {
            console.error(`  Revenue: Sent £${sentRevenue.toFixed(2)} but actual is £${actualRevenue.toFixed(2)} (diff: £${(actualRevenue - sentRevenue).toFixed(2)})`);
          }
          if (sentTables !== actualTablesSetUp) {
            console.error(`  Tables Set Up: Sent ${sentTables} but actual is ${actualTablesSetUp} (diff: ${actualTablesSetUp - sentTables})`);
          }
          if (sentActiveTables !== actualActiveTables) {
            console.error(`  Active Tables Count: Sent ${sentActiveTables} but actual is ${actualActiveTables} (diff: ${actualActiveTables - sentActiveTables})`);
          }
          if (sentTablesInUse !== actualTablesInUseDirect) {
            console.error(`  Tables In Use: Sent ${sentTablesInUse} but actual is ${actualTablesInUseDirect} (diff: ${actualTablesInUseDirect - sentTablesInUse})`);
          }
          if (sentTablesReserved !== actualTablesReservedDirect) {
            console.error(`  Tables Reserved Now: Sent ${sentTablesReserved} but actual is ${actualTablesReservedDirect} (diff: ${actualTablesReservedDirect - sentTablesReserved})`);
          }
          if (sentTodayOrders !== actualTodayOrders) {
            console.error(`  Today's Orders: Sent ${sentTodayOrders} but actual is ${actualTodayOrders} (diff: ${actualTodayOrders - sentTodayOrders})`);
          }
          if (sentLiveOrders !== actualLiveOrders) {
            console.error(`  Live Orders: Sent ${sentLiveOrders} but actual is ${actualLiveOrders} (diff: ${actualLiveOrders - sentLiveOrders})`);
          }
          if (sentEarlierToday !== actualEarlierToday) {
            console.error(`  Earlier Today: Sent ${sentEarlierToday} but actual is ${actualEarlierToday} (diff: ${actualEarlierToday - sentEarlierToday})`);
          }
          if (sentHistory !== actualHistory) {
            console.error(`  History: Sent ${sentHistory} but actual is ${actualHistory} (diff: ${actualHistory - sentHistory})`);
          }
        } else {
          console.log("✅ ALL COUNTS MATCH - Server sent correct values!");
        }
        
        console.log("═══════════════════════════════════════════════════════════");
        
        // Also log as structured object for easy filtering
        console.log("DASHBOARD COUNTS COMPARISON:", {
          venueId,
          timestamp: new Date().toISOString(),
          sent: {
            menuItems: sentMenuItems,
            revenue: sentRevenue,
            unpaid: sentUnpaid,
            tablesSetUp: sentTables,
            activeTablesCount: sentActiveTables,
            tablesInUse: sentTablesInUse,
            tablesReservedNow: sentTablesReserved,
            todayOrders: sentTodayOrders,
            liveOrders: sentLiveOrders,
            earlierToday: sentEarlierToday,
            history: sentHistory,
          },
          actual: {
            menuItems: actualMenuItems,
            revenue: actualRevenue,
            tablesSetUp: actualTablesSetUp,
            activeTablesCount: actualActiveTables,
            tablesInUse: actualTablesInUseDirect,
            tablesReservedNow: actualTablesReservedDirect,
            todayOrders: actualTodayOrders,
            liveOrders: actualLiveOrders,
            earlierToday: actualEarlierToday,
            history: actualHistory,
          },
          matches: {
            menuItems: sentMenuItems === actualMenuItems,
            revenue: Math.abs(sentRevenue - actualRevenue) < 0.01,
            tablesSetUp: sentTables === actualTablesSetUp,
            activeTablesCount: sentActiveTables === actualActiveTables,
            tablesInUse: sentTablesInUse === actualTablesInUseDirect,
            tablesReservedNow: sentTablesReserved === actualTablesReservedDirect,
            todayOrders: sentTodayOrders === actualTodayOrders,
            liveOrders: sentLiveOrders === actualLiveOrders,
            earlierToday: sentEarlierToday === actualEarlierToday,
            history: sentHistory === actualHistory,
          },
        });

        if (countsError) {
          console.error("❌ Error fetching actual counts:", countsError);
        }
      } catch (error) {
        console.error("❌ Error in fetchActualCounts:", error);
      }
    };

    // Only fetch if we have initial data to compare
    if (initialCounts || initialStats) {
      fetchActualCounts();
    }
  }, [venueId, initialCounts, initialStats]);

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
  // Only refresh if cache is stale - prevents unnecessary refreshes
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if cache is stale (older than 5 minutes)
      // This prevents flicker and unnecessary API calls
      if (!isCacheFresh(venueId)) {
        handleRefresh();
      }
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

  // Check authentication and venue access (must be before early returns)
  useEffect(() => {
    async function checkAuth() {

      // ALWAYS fetch role if we don't have it, regardless of cache
      // This ensures fresh sign-ins get the correct role immediately
      if (userRole && authCheckComplete) {
        // Only skip if we have role AND auth check is already complete
        return;
      }

      try {
        const supabase = supabaseBrowser();

        // Try BOTH getSession() and getUser() to ensure we have valid auth
        let session = null;
        let sessionError = null;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {

          // Try getSession first
          const sessionResult = await supabase.auth.getSession();
          sessionError = sessionResult.error;
          session = sessionResult.data.session;

          // If getSession fails, try getUser() which makes a server request
          if (!session?.user) {
            const userResult = await supabase.auth.getUser();
            // User data fetched - no need to store separately

            if (userResult.data?.user && !userResult.error) {
              // After getUser(), try getSession again
              const retrySession = await supabase.auth.getSession();
              session = retrySession.data.session;
              sessionError = retrySession.error;
                // Session check complete
            }
          }

          if (session?.user) {
            break;
          }

          if (retries < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          retries++;
        }

        if (sessionError) {
            // Session error logged
          // NO REDIRECTS - User requested ZERO sign-in redirects
          // Just log and continue - might be a temporary error
        }

        if (!session?.user) {
          // NO REDIRECTS - User requested ZERO sign-in redirects
          // Use cached user if available
          // Empty blocks removed - no action needed here
          // Don't return - continue with cached data or proceed without auth
        } else {
          setUser(session.user);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`dashboard_user_${venueId}`, JSON.stringify(session.user));
          }
        }

        const userId = user?.id || session?.user?.id;

        if (!userId) {
          if (venue) {
            setAuthCheckComplete(true);
          }
          return;
        }

        // Check if user is the venue owner
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .select("*")
          .eq("venue_id", venueId)
          .eq("owner_user_id", userId)
          .maybeSingle();

          // Venue data fetched

        // If venue query fails with 406 or other errors, log but don't block
        if (venueError) {
            // Venue error logged
          // Don't redirect - might be a temporary Supabase issue
          // The user might still have access via staff role or cached data
        }

        const isOwner = !!venueData;

        // Check if user has a staff role for this venue
        const { data: roleData, error: roleError } = await supabase
          .from("user_venue_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("venue_id", venueId)
          .maybeSingle();

          // Role data fetched

        // If role query fails, log but don't block
        if (roleError) {
            // Role error logged
        }

        const isStaff = !!roleData;

        // NO REDIRECTS - User requested ZERO sign-in redirects
        // Always allow access - fail open approach
        if (!isOwner && !isStaff && !venueError && !roleError) {
          // Use cached venue if available - no action needed
        }

        // If queries failed but we have a cached venue, allow access
        // Empty block removed - no action needed

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
        // No role assigned - continue without blocking

        setAuthCheckComplete(true);
      } catch (_error) {
        setAuthCheckComplete(true);
      }
    }

    checkAuth().catch(() => {
      // Error handled in checkAuth
    });
  }, [venueId]);

  // Log whenever userRole changes for dashboard rendering
  useEffect(() => {}, [userRole]);

  // Show loading while checking auth redirect (AFTER all hooks)
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

  // Don't render if no authenticated user (will redirect) (AFTER all hooks)
  if (!authUser) {
    return null;
  }

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
            {(() => {
              // CRITICAL: ALWAYS use initialCounts if it exists (even if tables_set_up is 0)
              // This ensures first load always shows correct server value, not stale cache
              // Only fall back to dashboardData if initialCounts doesn't exist at all
              const tablesValue = initialCounts !== null && initialCounts !== undefined
                ? (initialCounts.tables_set_up ?? 0)
                : (dashboardData.counts.tables_set_up ?? 0);
              console.error(`[FRONTEND RENDER] Tables Set Up card - Value being displayed: ${tablesValue}`);
              console.error(`[FRONTEND RENDER]   initialCounts exists: ${initialCounts !== null && initialCounts !== undefined}`);
              console.error(`[FRONTEND RENDER]   initialCounts?.tables_set_up: ${initialCounts?.tables_set_up ?? "undefined"}`);
              console.error(`[FRONTEND RENDER]   dashboardData.counts.tables_set_up: ${dashboardData.counts.tables_set_up ?? "undefined"}`);
              console.error(`[FRONTEND RENDER]   Using server value: ${initialCounts !== null && initialCounts !== undefined ? "YES ✅" : "NO - using dashboardData ❌"}`);
              return (
                <EnhancedStatCard
                  key="tables"
                  title="Tables Set Up"
                  value={tablesValue}
                  icon={Table}
                  iconColor="text-purple-600"
                  iconBgColor="bg-purple-100"
                  subtitle="all active"
                  tooltip="Manage table setup and reservations"
                />
              );
            })()}
          </Link>

          {/* Card 4: Menu Items */}
          <Link href={`/dashboard/${venueId}/menu-management`} className="block">
            {(() => {
              // CRITICAL: ALWAYS use initialStats if it exists (even if menuItems is 0)
              // This ensures first load always shows correct server value, not stale cache
              // Only fall back to dashboardData if initialStats doesn't exist at all
              const menuItemsValue = initialStats !== null && initialStats !== undefined
                ? (initialStats.menuItems ?? 0)
                : (dashboardData.stats.menuItems ?? 0);
              console.error(`[FRONTEND RENDER] Menu Items card - Value being displayed: ${menuItemsValue}`);
              console.error(`[FRONTEND RENDER]   initialStats exists: ${initialStats !== null && initialStats !== undefined}`);
              console.error(`[FRONTEND RENDER]   initialStats?.menuItems: ${initialStats?.menuItems ?? "undefined"}`);
              console.error(`[FRONTEND RENDER]   dashboardData.stats.menuItems: ${dashboardData.stats.menuItems ?? "undefined"}`);
              console.error(`[FRONTEND RENDER]   Using server value: ${initialStats !== null && initialStats !== undefined ? "YES ✅" : "NO - using dashboardData ❌"}`);
              return (
                <EnhancedStatCard
                  key="menu-items"
                  title="Menu Items"
                  value={menuItemsValue}
                  icon={ShoppingBag}
                  iconColor="text-orange-600"
                  iconBgColor="bg-orange-100"
                  subtitle="available"
                  tooltip="Edit your menu items"
                />
              );
            })()}
          </Link>
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
