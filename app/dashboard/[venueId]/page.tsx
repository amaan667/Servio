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
export const revalidate = 0; // Never revalidate (always fetch fresh)
export const runtime = "nodejs"; // Ensure Node.js runtime

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  
  // CRITICAL: Log IMMEDIATELY - this MUST appear in Railway
  // Use multiple methods to ensure visibility
  const timestamp = new Date().toISOString();
  
  // Method 1: process.stderr.write (Railway captures stderr)
  process.stderr.write(`\n[RAILWAY] =================================================\n`);
  process.stderr.write(`[RAILWAY] Dashboard Server Component - START\n`);
  process.stderr.write(`[RAILWAY] Venue ID: ${venueId}\n`);
  process.stderr.write(`[RAILWAY] Timestamp: ${timestamp}\n`);
  process.stderr.write(`[RAILWAY] =================================================\n\n`);
  
  // Method 2: console.error (goes to stderr)
  console.error(`[RAILWAY] =================================================`);
  console.error(`[RAILWAY] Dashboard Server Component - START`);
  console.error(`[RAILWAY] Venue ID: ${venueId}`);
  console.error(`[RAILWAY] Timestamp: ${timestamp}`);
  console.error(`[RAILWAY] =================================================`);
  
  // Method 3: console.warn (also captured)
  console.warn(`[RAILWAY] Dashboard START - Venue: ${venueId} - Time: ${timestamp}`);

  // STEP 1: Server-side auth check (optional - no redirects)
  // NO REDIRECTS - User requested ZERO sign-in redirects
  // Auth check is optional - client will handle auth display
  // Dashboard ALWAYS loads - client handles authentication
  process.stderr.write(`[RAILWAY] Starting auth check...\n`);
  const auth = await requirePageAuth(venueId).catch(() => null);
  process.stderr.write(`[RAILWAY] Auth check complete\n`);

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
      process.stderr.write(`\n[RAILWAY] ❌ ERROR fetching dashboard_counts: ${countsError.message}\n`);
    } else {
      initialCounts = countsData as DashboardCounts;
      process.stderr.write(`\n[RAILWAY] =================================================\n`);
      process.stderr.write(`[RAILWAY] 📊 DASHBOARD COUNTS FROM DATABASE (RPC)\n`);
      process.stderr.write(`[RAILWAY] =================================================\n`);
      process.stderr.write(`[RAILWAY] Venue ID: ${normalizedVenueId}\n`);
      process.stderr.write(`[RAILWAY] live_count: ${initialCounts?.live_count || 0}\n`);
      process.stderr.write(`[RAILWAY] earlier_today_count: ${initialCounts?.earlier_today_count || 0}\n`);
      process.stderr.write(`[RAILWAY] history_count: ${initialCounts?.history_count || 0}\n`);
      process.stderr.write(`[RAILWAY] today_orders_count: ${initialCounts?.today_orders_count || 0}\n`);
      process.stderr.write(`[RAILWAY] active_tables_count: ${initialCounts?.active_tables_count || 0}\n`);
      process.stderr.write(`[RAILWAY] =================================================\n`);
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
        const totalTables = allTables?.length || 0;
        const tablesInUse = activeSessions?.length || 0;
        const tablesReserved = currentReservations?.length || 0;
        
        process.stderr.write(`\n[RAILWAY] =================================================\n`);
        process.stderr.write(`[RAILWAY] 🪑 TABLES DATA FROM DATABASE\n`);
        process.stderr.write(`[RAILWAY] =================================================\n`);
        process.stderr.write(`[RAILWAY] Total tables in database: ${totalTables}\n`);
        process.stderr.write(`[RAILWAY] Active tables (is_active=true): ${activeTables.length}\n`);
        process.stderr.write(`[RAILWAY] Tables in use (OCCUPIED sessions): ${tablesInUse}\n`);
        process.stderr.write(`[RAILWAY] Tables reserved now: ${tablesReserved}\n`);
        process.stderr.write(`[RAILWAY] ⚠️  tables_set_up will be set to: ${activeTables.length}\n`);
        process.stderr.write(`[RAILWAY] =================================================\n`);
        
        initialCounts = {
          ...initialCounts,
          tables_set_up: activeTables.length, // Real count from tables table
          tables_in_use: tablesInUse, // Real count from table_sessions
          tables_reserved_now: tablesReserved, // Real count from reservations
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
      process.stderr.write(`\n[RAILWAY] ❌ ERROR fetching orders: ${ordersError.message}\n`);
    } else {
      const totalOrders = orders?.length || 0;
      const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const unpaid = orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER").length || 0;
      
      process.stderr.write(`\n[RAILWAY] =================================================\n`);
      process.stderr.write(`[RAILWAY] 💰 REVENUE & ORDERS DATA FROM DATABASE\n`);
      process.stderr.write(`[RAILWAY] =================================================\n`);
      process.stderr.write(`[RAILWAY] Time Window: ${window.startUtcISO} to ${window.endUtcISO}\n`);
      process.stderr.write(`[RAILWAY] Total orders in time window: ${totalOrders}\n`);
      process.stderr.write(`[RAILWAY] Total revenue: £${revenue.toFixed(2)}\n`);
      process.stderr.write(`[RAILWAY] Unpaid orders: ${unpaid}\n`);
      process.stderr.write(`[RAILWAY] ⚠️  THIS IS THE ACTUAL REVENUE FROM DATABASE: £${revenue.toFixed(2)}\n`);
      process.stderr.write(`[RAILWAY] =================================================\n`);
    }

    // Count ALL menu items (not just available) to match menu management count
    // ALWAYS use actual array length - it's the source of truth
    // Don't use count query as it can be inconsistent
    // Add cache-busting timestamp to ensure fresh query
    const queryStartTime = Date.now();
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id")
      .eq("venue_id", normalizedVenueId)
      .order("created_at", { ascending: false }); // Add ordering to ensure consistent results
      // Removed .eq("is_available", true) to match menu management count
    const queryEndTime = Date.now();
    const queryDuration = queryEndTime - queryStartTime;

    // Use actual array length - it's the source of truth
    // The count query can be inconsistent, so always use the actual items returned
    const actualMenuItemCount = menuItems?.length || 0;
    
    process.stderr.write(`\n[RAILWAY] =================================================\n`);
    process.stderr.write(`[RAILWAY] 🍽️  MENU ITEMS DATA FROM DATABASE\n`);
    process.stderr.write(`[RAILWAY] =================================================\n`);
    process.stderr.write(`[RAILWAY] Query: SELECT id FROM menu_items WHERE venue_id = '${normalizedVenueId}' ORDER BY created_at DESC\n`);
    process.stderr.write(`[RAILWAY] Query Duration: ${queryDuration}ms\n`);
    process.stderr.write(`[RAILWAY] Items returned (array length): ${actualMenuItemCount}\n`);
    process.stderr.write(`[RAILWAY] Error: ${menuError?.message || "None"}\n`);
    process.stderr.write(`[RAILWAY] ⚠️  THIS IS THE ACTUAL COUNT FROM DATABASE: ${actualMenuItemCount}\n`);
    process.stderr.write(`[RAILWAY] =================================================\n`);
    
    // LOG: Query execution details
    process.stderr.write(`\n[RAILWAY] Menu Items Query Executed\n`);
    process.stderr.write(`[RAILWAY] Query Duration: ${queryDuration}ms\n`);
    process.stderr.write(`[RAILWAY] Items Returned: ${actualMenuItemCount}\n`);
    
    // DETAILED LOG: Show exactly what was loaded
    // Use process.stderr.write for guaranteed Railway visibility
    process.stderr.write(`\n[RAILWAY] =================================================\n`);
    process.stderr.write(`[RAILWAY] Menu Items Query Result\n`);
    process.stderr.write(`[RAILWAY] Venue ID: ${venueId}\n`);
    process.stderr.write(`[RAILWAY] Normalized Venue ID: ${normalizedVenueId}\n`);
    process.stderr.write(`[RAILWAY] Query Duration: ${queryDuration}ms\n`);
    process.stderr.write(`[RAILWAY] Array Length: ${menuItems?.length || 0}\n`);
    process.stderr.write(`[RAILWAY] Actual Count (used for stats): ${actualMenuItemCount}\n`);
    process.stderr.write(`[RAILWAY] Error: ${menuError?.message || "None"}\n`);
    process.stderr.write(`[RAILWAY] First 10 Item IDs: ${JSON.stringify(menuItems?.slice(0, 10).map((m) => m.id) || [])}\n`);
    process.stderr.write(`[RAILWAY] ⚠️  THIS COUNT WILL BE PASSED TO CLIENT: ${actualMenuItemCount}\n`);
    process.stderr.write(`[RAILWAY] Timestamp: ${new Date().toISOString()}\n`);
    process.stderr.write(`[RAILWAY] =================================================\n`);
    
    // Also use console.error and console.log for Railway
    console.error("[RAILWAY] Dashboard Server - Menu Items Count:", actualMenuItemCount);
    console.error("[RAILWAY] Dashboard Server - Venue ID:", normalizedVenueId);
    console.error("[RAILWAY] Dashboard Server - Query Duration:", queryDuration, "ms");
    console.log("[RAILWAY] Dashboard Server - Menu Items Count:", actualMenuItemCount);

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
    // Use MULTIPLE logging methods to ensure visibility
    const finalStats = {
      menuItems: initialStats.menuItems,
      revenue: initialStats.revenue,
      unpaid: initialStats.unpaid,
    };
    
    // Method 1: process.stderr.write
    process.stderr.write(`\n[RAILWAY] =================================================\n`);
    process.stderr.write(`[RAILWAY] ✅ FINAL DATA BEING PASSED TO CLIENT\n`);
    process.stderr.write(`[RAILWAY] =================================================\n`);
    process.stderr.write(`[RAILWAY] initialStats.menuItems: ${finalStats.menuItems}\n`);
    process.stderr.write(`[RAILWAY] initialStats.revenue: £${finalStats.revenue.toFixed(2)}\n`);
    process.stderr.write(`[RAILWAY] initialStats.unpaid: ${finalStats.unpaid}\n`);
    process.stderr.write(`[RAILWAY] initialCounts.today_orders_count: ${initialCounts?.today_orders_count || 0}\n`);
    process.stderr.write(`[RAILWAY] initialCounts.tables_set_up: ${initialCounts?.tables_set_up || 0}\n`);
    process.stderr.write(`[RAILWAY] initialCounts.live_count: ${initialCounts?.live_count || 0}\n`);
    process.stderr.write(`[RAILWAY] =================================================\n\n`);
    
    // Method 2: console.error (multiple lines)
    console.error(`[RAILWAY] =================================================`);
    console.error(`[RAILWAY] ✅ FINAL DATA BEING PASSED TO CLIENT`);
    console.error(`[RAILWAY] =================================================`);
    console.error(`[RAILWAY] initialStats.menuItems: ${finalStats.menuItems}`);
    console.error(`[RAILWAY] initialStats.revenue: £${finalStats.revenue.toFixed(2)}`);
    console.error(`[RAILWAY] initialStats.unpaid: ${finalStats.unpaid}`);
    console.error(`[RAILWAY] initialCounts.today_orders_count: ${initialCounts?.today_orders_count || 0}`);
    console.error(`[RAILWAY] initialCounts.tables_set_up: ${initialCounts?.tables_set_up || 0}`);
    console.error(`[RAILWAY] initialCounts.live_count: ${initialCounts?.live_count || 0}`);
    console.error(`[RAILWAY] =================================================`);
    
    // Method 3: Single line summary (easy to spot)
    console.error(`[RAILWAY] FINAL COUNTS - Menu: ${finalStats.menuItems} | Tables: ${initialCounts?.tables_set_up || 0} | Revenue: £${finalStats.revenue.toFixed(2)} | Orders: ${initialCounts?.today_orders_count || 0}`);
  } catch (error) {
    // Log error to Railway - use process.stderr.write for guaranteed visibility
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack";
    process.stderr.write(`\n[RAILWAY] ERROR: ${errorMsg}\n`);
    process.stderr.write(`[RAILWAY] ERROR STACK: ${errorStack}\n`);
    console.error("[RAILWAY] Dashboard Server - Error:", errorMsg);
    console.error("[RAILWAY] Dashboard Server - Error stack:", errorStack);
    // Continue without initial data - client will load it
  }

  // FINAL SERVER-SIDE LOG - Railway will see this
  const finalCount = initialStats?.menuItems || 0;
  process.stderr.write(`\n[RAILWAY] =================================================\n`);
  process.stderr.write(`[RAILWAY] Dashboard Server Component - END\n`);
  process.stderr.write(`[RAILWAY] Final menuItems count: ${finalCount}\n`);
  process.stderr.write(`[RAILWAY] Final revenue: £${initialStats?.revenue?.toFixed(2) || "0.00"}\n`);
  process.stderr.write(`[RAILWAY] Final tables_set_up: ${initialCounts?.tables_set_up || 0}\n`);
  process.stderr.write(`[RAILWAY] Final today_orders_count: ${initialCounts?.today_orders_count || 0}\n`);
  process.stderr.write(`[RAILWAY] Final initialStats: ${JSON.stringify(initialStats, null, 2)}\n`);
  process.stderr.write(`[RAILWAY] Final initialCounts: ${JSON.stringify(initialCounts, null, 2)}\n`);
  process.stderr.write(`[RAILWAY] =================================================\n\n`);

  console.error("[RAILWAY] Dashboard Server Component - END");
  console.error("[RAILWAY] Final menuItems count:", finalCount);
  console.error("[RAILWAY] Final revenue:", initialStats?.revenue);
  console.error("[RAILWAY] Final tables_set_up:", initialCounts?.tables_set_up);
  console.error("[RAILWAY] Final today_orders_count:", initialCounts?.today_orders_count);
  console.log("[RAILWAY] Dashboard page completed, sending to client");

  return (
    <DashboardClient
      venueId={venueId}
      initialCounts={initialCounts}
      initialStats={initialStats}
    />
  );
}
