import React from "react";
import DashboardClient from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Fetch initial dashboard data on server WITHOUT auth (use admin client)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialCounts: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialStats: any = null;

  try {
    console.info("[DASHBOARD SSR] Fetching initial data for venueId:", venueId);
    const supabase = createAdminClient(); // Use admin client - no auth required!
    const venueTz = "Europe/London";
    const window = todayWindowForTZ(venueTz);

    console.info("[DASHBOARD SSR] Time window:", window);

    // Fetch dashboard counts using RPC
    console.info("[DASHBOARD SSR] Calling dashboard_counts RPC...");
    const { data: countsData, error: countsError } = await supabase
      .rpc("dashboard_counts", {
        p_venue_id: venueId,
        p_tz: venueTz,
        p_live_window_mins: 30,
      })
      .single();

    if (countsError) {
      console.error("[DASHBOARD SSR] dashboard_counts RPC failed:", countsError);
    } else {
      console.info("[DASHBOARD SSR] Counts fetched:", countsData);
      initialCounts = countsData;
    }

    // Fetch REAL table counts directly from tables table (no RPC, no caching)
    console.info("[DASHBOARD SSR] Fetching real table counts from tables table...");

    // Get total tables set up
    const { data: allTables, error: tablesError } = await supabase
      .from("tables")
      .select("id, is_active")
      .eq("venue_id", venueId);

    if (tablesError) {
      console.error("[DASHBOARD SSR] Tables fetch failed:", tablesError);
    } else {
      console.info("[DASHBOARD SSR] Tables fetched:", allTables?.length || 0);

      // Get active table sessions (currently occupied)
      const { data: activeSessions, error: sessionsError } = await supabase
        .from("table_sessions")
        .select("id, status, table_id")
        .eq("venue_id", venueId)
        .eq("status", "OCCUPIED")
        .is("closed_at", null);

      if (sessionsError) {
        console.error("[DASHBOARD SSR] Sessions fetch failed:", sessionsError);
      } else {
        console.info("[DASHBOARD SSR] Active sessions fetched:", activeSessions?.length || 0);
      }

      // Get current reservations
      const now = new Date();
      const { data: currentReservations, error: reservationsError } = await supabase
        .from("reservations")
        .select("id")
        .eq("venue_id", venueId)
        .eq("status", "BOOKED")
        .lte("start_time", now.toISOString())
        .gte("end_time", now.toISOString());

      if (reservationsError) {
        console.error("[DASHBOARD SSR] Reservations fetch failed:", reservationsError);
      } else {
        console.info(
          "[DASHBOARD SSR] Current reservations fetched:",
          currentReservations?.length || 0
        );
      }

      // Merge real counts into initialCounts
      if (initialCounts) {
        const activeTables = allTables?.filter((t) => t.is_active) || [];
        initialCounts = {
          ...initialCounts,
          tables_set_up: activeTables.length, // Real count from tables table
          tables_in_use: activeSessions?.length || 0, // Real count from table_sessions
          tables_reserved_now: currentReservations?.length || 0, // Real count from reservations
          active_tables_count: activeTables.length, // Same as tables_set_up
        };
        console.info("[DASHBOARD SSR] Merged REAL table counters:", initialCounts);
      }
    }

    // Fetch stats (revenue, menu items)
    console.info("[DASHBOARD SSR] Fetching orders for revenue...");
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("total_amount, order_status")
      .eq("venue_id", venueId)
      .gte("created_at", window.startUtcISO)
      .lt("created_at", window.endUtcISO)
      .neq("order_status", "CANCELLED");

    if (ordersError) {
      console.error("[DASHBOARD SSR] Orders fetch failed:", ordersError);
    } else {
      console.info("[DASHBOARD SSR] Orders fetched:", orders?.length || 0);
    }

    console.info("[DASHBOARD SSR] Fetching menu items...");
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_available", true);

    if (menuError) {
      console.error("[DASHBOARD SSR] Menu items fetch failed:", menuError);
    } else {
      console.info("[DASHBOARD SSR] Menu items fetched:", menuItems?.length || 0);
    }

    const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

    initialStats = {
      revenue,
      menuItems: menuItems?.length || 0,
      unpaid,
    };

    console.info("[DASHBOARD SSR] Initial stats calculated:", initialStats);
    console.info("[DASHBOARD SSR] Initial counts final:", initialCounts);
  } catch (error) {
    console.error("[DASHBOARD SSR] Failed to fetch initial data:", error);
    // Continue without initial data - client will load it
  }

  console.info("[DASHBOARD SSR] Rendering client with data:", {
    hasCounts: !!initialCounts,
    hasStats: !!initialStats,
    countsValue: initialCounts,
    statsValue: initialStats,
  });

  return (
    <DashboardClient venueId={venueId} initialCounts={initialCounts} initialStats={initialStats} />
  );
}
