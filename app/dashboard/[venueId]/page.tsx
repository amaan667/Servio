import React from "react";
import DashboardClient from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { todayWindowForTZ } from "@/lib/time";

// Force dynamic rendering to prevent stale cached menu counts
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;

  // Fetch initial dashboard data on server WITHOUT auth (use admin client)

  let initialCounts: any = null;

  let initialStats: any = null;

  try {
    const supabase = createAdminClient(); // Use admin client - no auth required!
    const venueTz = "Europe/London";
    const window = todayWindowForTZ(venueTz);

    // Fetch dashboard counts using RPC
    const { data: countsData, error: countsError } = await supabase
      .rpc("dashboard_counts", {
        p_venue_id: venueId,
        p_tz: venueTz,
        p_live_window_mins: 30,
      })
      .single();

    if (countsError) {
      /* Empty */
    } else {
      initialCounts = countsData;
    }

    // Fetch REAL table counts directly from tables table (no RPC, no caching)

    // Get total tables set up
    const { data: allTables, error: tablesError } = await supabase
      .from("tables")
      .select("id, is_active")
      .eq("venue_id", venueId);

    if (tablesError) {
      /* Empty */
    } else {
      // Get active table sessions (currently occupied)
      const { data: activeSessions, error: sessionsError } = await supabase
        .from("table_sessions")
        .select("id, status, table_id")
        .eq("venue_id", venueId)
        .eq("status", "OCCUPIED")
        .is("closed_at", null);

      if (sessionsError) {
        /* Empty */
      } else {
        // Intentionally empty
      }

      // Get current reservations
      const now = new Date();
      const { data: currentReservations, error: reservationsError } = await supabase
        .from("reservations")
        .select("id")
        .eq("venue_id", venueId)
        .eq("status", "BOOKED")
        .lte("start_at", now.toISOString())
        .gte("end_at", now.toISOString());

      if (reservationsError) {
        /* Empty */
      } else {
        // Intentionally empty
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
      }
    }

    // Fetch stats (revenue, menu items)
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("total_amount, order_status, payment_status")
      .eq("venue_id", venueId)
      .gte("created_at", window.startUtcISO)
      .lt("created_at", window.endUtcISO)
      .neq("order_status", "CANCELLED")
      .neq("order_status", "REFUNDED");

    if (ordersError) {
      /* Empty */
    } else {
      // Intentionally empty
    }

    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", venueId)
      .eq("is_available", true);

    // Log menu items count for debugging
    console.log(`[DASHBOARD] Menu items query for venue ${venueId}:`, {
      count: menuItems?.length || 0,
      hasError: !!menuError,
      errorMessage: menuError?.message || null,
      venueId,
      timestamp: new Date().toISOString(),
    });

    if (menuError) {
      console.error(`[DASHBOARD] Error fetching menu items for venue ${venueId}:`, menuError);
    }

    const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

    initialStats = {
      revenue,
      menuItems: menuItems?.length || 0,
      unpaid,
    };

    console.log(`[DASHBOARD] Final initialStats for venue ${venueId}:`, initialStats);
  } catch (_error) {
    // Continue without initial data - client will load it
  }

  return (
    <DashboardClient venueId={venueId} initialCounts={initialCounts} initialStats={initialStats} />
  );
}
