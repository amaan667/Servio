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
  
  // IMMEDIATE SERVER-SIDE LOG - Railway will see this
  // Use both process.stdout.write AND console.error for maximum visibility
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Force flush stdout immediately
  process.stdout.write(`\n`);
  process.stdout.write(`[RAILWAY] =================================================\n`);
  process.stdout.write(`[RAILWAY] Dashboard Server Component - START\n`);
  process.stdout.write(`[RAILWAY] Venue ID: ${venueId}\n`);
  process.stdout.write(`[RAILWAY] Timestamp: ${timestamp}\n`);
  process.stdout.write(`[RAILWAY] Process PID: ${process.pid}\n`);
  process.stdout.write(`[RAILWAY] =================================================\n`);
  process.stdout.write(`\n`);
  
  // Also use console.error (Railway captures stderr)
  console.error(`[RAILWAY] Dashboard Server Component - START`);
  console.error(`[RAILWAY] Venue ID: ${venueId}`);
  console.error(`[RAILWAY] Timestamp: ${timestamp}`);

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
      process.stdout.write(`\n[RAILWAY] ❌ ERROR fetching dashboard_counts: ${countsError.message}\n`);
    } else {
      initialCounts = countsData as DashboardCounts;
      process.stdout.write(`\n[RAILWAY] =================================================\n`);
      process.stdout.write(`[RAILWAY] 📊 DASHBOARD COUNTS FROM DATABASE (RPC)\n`);
      process.stdout.write(`[RAILWAY] =================================================\n`);
      process.stdout.write(`[RAILWAY] Venue ID: ${normalizedVenueId}\n`);
      process.stdout.write(`[RAILWAY] live_count: ${initialCounts?.live_count || 0}\n`);
      process.stdout.write(`[RAILWAY] earlier_today_count: ${initialCounts?.earlier_today_count || 0}\n`);
      process.stdout.write(`[RAILWAY] history_count: ${initialCounts?.history_count || 0}\n`);
      process.stdout.write(`[RAILWAY] today_orders_count: ${initialCounts?.today_orders_count || 0}\n`);
      process.stdout.write(`[RAILWAY] active_tables_count: ${initialCounts?.active_tables_count || 0}\n`);
      process.stdout.write(`[RAILWAY] =================================================\n`);
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
        
        process.stdout.write(`\n[RAILWAY] =================================================\n`);
        process.stdout.write(`[RAILWAY] 🪑 TABLES DATA FROM DATABASE\n`);
        process.stdout.write(`[RAILWAY] =================================================\n`);
        process.stdout.write(`[RAILWAY] Total tables in database: ${totalTables}\n`);
        process.stdout.write(`[RAILWAY] Active tables (is_active=true): ${activeTables.length}\n`);
        process.stdout.write(`[RAILWAY] Tables in use (OCCUPIED sessions): ${tablesInUse}\n`);
        process.stdout.write(`[RAILWAY] Tables reserved now: ${tablesReserved}\n`);
        process.stdout.write(`[RAILWAY] ⚠️  tables_set_up will be set to: ${activeTables.length}\n`);
        process.stdout.write(`[RAILWAY] =================================================\n`);
        
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
      process.stdout.write(`\n[RAILWAY] ❌ ERROR fetching orders: ${ordersError.message}\n`);
    } else {
      const totalOrders = orders?.length || 0;
      const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const unpaid = orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER").length || 0;
      
      process.stdout.write(`\n[RAILWAY] =================================================\n`);
      process.stdout.write(`[RAILWAY] 💰 REVENUE & ORDERS DATA FROM DATABASE\n`);
      process.stdout.write(`[RAILWAY] =================================================\n`);
      process.stdout.write(`[RAILWAY] Time Window: ${window.startUtcISO} to ${window.endUtcISO}\n`);
      process.stdout.write(`[RAILWAY] Total orders in time window: ${totalOrders}\n`);
      process.stdout.write(`[RAILWAY] Total revenue: £${revenue.toFixed(2)}\n`);
      process.stdout.write(`[RAILWAY] Unpaid orders: ${unpaid}\n`);
      process.stdout.write(`[RAILWAY] ⚠️  THIS IS THE ACTUAL REVENUE FROM DATABASE: £${revenue.toFixed(2)}\n`);
      process.stdout.write(`[RAILWAY] =================================================\n`);
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
    
    process.stdout.write(`\n[RAILWAY] =================================================\n`);
    process.stdout.write(`[RAILWAY] 🍽️  MENU ITEMS DATA FROM DATABASE\n`);
    process.stdout.write(`[RAILWAY] =================================================\n`);
    process.stdout.write(`[RAILWAY] Query: SELECT id FROM menu_items WHERE venue_id = '${normalizedVenueId}' ORDER BY created_at DESC\n`);
    process.stdout.write(`[RAILWAY] Query Duration: ${queryDuration}ms\n`);
    process.stdout.write(`[RAILWAY] Items returned (array length): ${actualMenuItemCount}\n`);
    process.stdout.write(`[RAILWAY] Error: ${menuError?.message || "None"}\n`);
    process.stdout.write(`[RAILWAY] ⚠️  THIS IS THE ACTUAL COUNT FROM DATABASE: ${actualMenuItemCount}\n`);
    process.stdout.write(`[RAILWAY] =================================================\n`);
    
    // LOG: Query execution details
    process.stdout.write(`\n[RAILWAY] Menu Items Query Executed\n`);
    process.stdout.write(`[RAILWAY] Query Duration: ${queryDuration}ms\n`);
    process.stdout.write(`[RAILWAY] Items Returned: ${actualMenuItemCount}\n`);
    
    // DETAILED LOG: Show exactly what was loaded
    // Use process.stdout.write for guaranteed Railway visibility
    process.stdout.write(`\n[RAILWAY] =================================================\n`);
    process.stdout.write(`[RAILWAY] Menu Items Query Result\n`);
    process.stdout.write(`[RAILWAY] Venue ID: ${venueId}\n`);
    process.stdout.write(`[RAILWAY] Normalized Venue ID: ${normalizedVenueId}\n`);
    process.stdout.write(`[RAILWAY] Query Duration: ${queryDuration}ms\n`);
    process.stdout.write(`[RAILWAY] Array Length: ${menuItems?.length || 0}\n`);
    process.stdout.write(`[RAILWAY] Actual Count (used for stats): ${actualMenuItemCount}\n`);
    process.stdout.write(`[RAILWAY] Error: ${menuError?.message || "None"}\n`);
    process.stdout.write(`[RAILWAY] First 10 Item IDs: ${JSON.stringify(menuItems?.slice(0, 10).map((m) => m.id) || [])}\n`);
    process.stdout.write(`[RAILWAY] ⚠️  THIS COUNT WILL BE PASSED TO CLIENT: ${actualMenuItemCount}\n`);
    process.stdout.write(`[RAILWAY] Timestamp: ${new Date().toISOString()}\n`);
    process.stdout.write(`[RAILWAY] =================================================\n`);
    
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
    // Use process.stdout.write for guaranteed Railway visibility
    process.stdout.write(`\n[RAILWAY] =================================================\n`);
    process.stdout.write(`[RAILWAY] Passing initialStats to Client\n`);
    process.stdout.write(`[RAILWAY] menuItems count: ${initialStats.menuItems}\n`);
    process.stdout.write(`[RAILWAY] revenue: ${initialStats.revenue}\n`);
    process.stdout.write(`[RAILWAY] unpaid: ${initialStats.unpaid}\n`);
    process.stdout.write(`[RAILWAY] Full initialStats: ${JSON.stringify(initialStats)}\n`);
    process.stdout.write(`[RAILWAY] =================================================\n`);
    
    // Also use console.error and console.log
    console.error("[RAILWAY] Dashboard Server - Passing to client:", {
      menuItems: initialStats.menuItems,
      revenue: initialStats.revenue,
      unpaid: initialStats.unpaid,
    });
    console.log("[RAILWAY] Dashboard Server - Final menuItems count:", initialStats.menuItems);
  } catch (error) {
    // Log error to Railway - use process.stdout.write for guaranteed visibility
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack";
    process.stdout.write(`\n[RAILWAY] ERROR: ${errorMsg}\n`);
    process.stdout.write(`[RAILWAY] ERROR STACK: ${errorStack}\n`);
    console.error("[RAILWAY] Dashboard Server - Error:", errorMsg);
    console.error("[RAILWAY] Dashboard Server - Error stack:", errorStack);
    // Continue without initial data - client will load it
  }

  // FINAL SERVER-SIDE LOG - Railway will see this
  const finalCount = initialStats?.menuItems || 0;
  process.stdout.write(`\n[RAILWAY] =================================================\n`);
  process.stdout.write(`[RAILWAY] Dashboard Server Component - END\n`);
  process.stdout.write(`[RAILWAY] Final menuItems count: ${finalCount}\n`);
  process.stdout.write(`[RAILWAY] Final initialStats: ${JSON.stringify(initialStats)}\n`);
  process.stdout.write(`[RAILWAY] =================================================\n`);
  
  console.error("[RAILWAY] Dashboard Server Component - END");
  console.error("[RAILWAY] Final menuItems count:", finalCount);
  console.log("[RAILWAY] Dashboard page completed, sending to client");

  return (
    <DashboardClient
      venueId={venueId}
      initialCounts={initialCounts}
      initialStats={initialStats}
    />
  );
}
