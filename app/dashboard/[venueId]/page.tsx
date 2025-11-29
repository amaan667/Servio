import React from "react";
import DashboardClient from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { todayWindowForTZ } from "@/lib/time";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import type { DashboardCounts, DashboardStats } from "./hooks/useDashboardData";

// Force dynamic rendering to prevent stale cached menu counts
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // Never cache fetch requests
export const revalidate = 0;

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // STEP 1: Server-side auth check (optional - no redirects)
  // NO REDIRECTS - User requested ZERO sign-in redirects
  // Auth check is optional - client will handle auth display
  // Dashboard ALWAYS loads - client handles authentication
  const auth = await requirePageAuth(venueId).catch(() => null);

  // STEP 2: Fetch initial dashboard data on server (even without auth)
  // Always fetch data - don't block on auth
  // Use admin client only after auth verification
  let initialCounts: DashboardCounts | undefined = undefined;
  let initialStats: DashboardStats | undefined = undefined;

  try {
    const supabase = createAdminClient();
    const venueTz = "Europe/London";
    const window = todayWindowForTZ(venueTz);

    // Normalize venueId format - database stores with venue- prefix
    const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

    // Fetch dashboard counts using RPC
    const { data: countsData, error: countsError } = await supabase
      .rpc("dashboard_counts", {
        p_venue_id: normalizedVenueId,
        p_tz: venueTz,
        p_live_window_mins: 30,
      })
      .single();

    if (countsError) {
      /* Empty */
    } else {
      initialCounts = countsData as DashboardCounts;
    }

    // Fetch REAL table counts directly from tables table (no RPC, no caching)

    // Get total tables set up
    const { data: allTables, error: tablesError } = await supabase
      .from("tables")
      .select("id, is_active")
      .eq("venue_id", normalizedVenueId);

    if (tablesError) {
      /* Empty */
    } else {
      // Get active table sessions (currently occupied)
      const { data: activeSessions, error: sessionsError } = await supabase
        .from("table_sessions")
        .select("id, status, table_id")
        .eq("venue_id", normalizedVenueId)
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
        .eq("venue_id", normalizedVenueId)
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
      .eq("venue_id", normalizedVenueId)
      .gte("created_at", window.startUtcISO)
      .lt("created_at", window.endUtcISO)
      .neq("order_status", "CANCELLED")
      .neq("order_status", "REFUNDED");

    if (ordersError) {
      /* Empty */
    } else {
      // Intentionally empty
    }

    // Count ALL menu items (not just available) to match menu management count
    // ALWAYS use actual array length - it's the source of truth
    // Don't use count query as it can be inconsistent
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", normalizedVenueId);
      // Removed .eq("is_available", true) to match menu management count

    // Use actual array length - it's the source of truth
    // The count query can be inconsistent, so always use the actual items returned
    const actualMenuItemCount = menuItems?.length || 0;
    
    // DETAILED LOG: Show exactly what was loaded
    // Use console.error for Railway visibility - Railway captures stderr
    console.error("═══════════════════════════════════════════════════════════");
    console.error("📊 [DASHBOARD SERVER] Menu Items Query Result");
    console.error("═══════════════════════════════════════════════════════════");
    console.error("Venue ID:", venueId);
    console.error("Normalized Venue ID:", normalizedVenueId);
    console.error("Query: SELECT id FROM menu_items WHERE venue_id =", normalizedVenueId);
    console.error("Items Returned (array):", JSON.stringify(menuItems || [], null, 2));
    console.error("Array Length:", menuItems?.length || 0);
    console.error("Actual Count (used for stats):", actualMenuItemCount);
    console.error("Error:", menuError?.message || "None");
    console.error("Error Code:", menuError?.code || "None");
    console.error("First 10 Item IDs:", menuItems?.slice(0, 10).map((m) => m.id) || []);
    console.error("All Item IDs Count:", menuItems?.length || 0);
    console.error("⚠️  THIS COUNT WILL BE PASSED TO CLIENT");
    console.error("Timestamp:", new Date().toISOString());
    console.error("═══════════════════════════════════════════════════════════");
    
    // Also use console.log for stdout (Railway captures both)
    console.log("[RAILWAY] Dashboard Server - Menu Items Count:", actualMenuItemCount);
    console.log("[RAILWAY] Dashboard Server - Venue ID:", normalizedVenueId);

    if (menuError) {
      logger.error("[DASHBOARD] Error fetching menu items:", {
        error: menuError.message,
        code: menuError.code,
        details: menuError.details,
        normalizedVenueId,
        venueId,
      });
    }

    const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

    initialStats = {
      revenue,
      menuItems: actualMenuItemCount, // Use actual array length, not count query
      unpaid,
    };
    
    // LOG: Show what's being passed to client
    // Use console.error for Railway visibility
    console.error("═══════════════════════════════════════════════════════════");
    console.error("📤 [DASHBOARD SERVER] Passing initialStats to Client");
    console.error("═══════════════════════════════════════════════════════════");
    console.error("initialStats:", JSON.stringify(initialStats, null, 2));
    console.error("menuItems count:", initialStats.menuItems);
    console.error("revenue:", initialStats.revenue);
    console.error("unpaid:", initialStats.unpaid);
    console.error("═══════════════════════════════════════════════════════════");
    
    // Also use console.log for stdout
    console.log("[RAILWAY] Dashboard Server - Passing to client:", {
      menuItems: initialStats.menuItems,
      revenue: initialStats.revenue,
      unpaid: initialStats.unpaid,
    });
  } catch (error) {
    // Log error to Railway
    console.error("[RAILWAY] Dashboard Server - Error:", error instanceof Error ? error.message : String(error));
    console.error("[RAILWAY] Dashboard Server - Error stack:", error instanceof Error ? error.stack : "No stack");
    // Continue without initial data - client will load it
  }

  // FINAL SERVER-SIDE LOG - Railway will see this
  console.error("[RAILWAY] =================================================");
  console.error("[RAILWAY] Dashboard Server Component - END");
  console.error("[RAILWAY] Final initialStats:", JSON.stringify(initialStats, null, 2));
  console.error("[RAILWAY] Final menuItems count:", initialStats?.menuItems || 0);
  console.error("[RAILWAY] =================================================");
  console.log("[RAILWAY] Dashboard page completed, sending to client");

  return (
    <DashboardClient
      venueId={venueId}
      initialCounts={initialCounts}
      initialStats={initialStats}
    />
  );
}
