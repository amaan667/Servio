import React from "react";
import DashboardClient from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { todayWindowForTZ } from "@/lib/time";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { fetchMenuItemCount, fetchUnifiedCounts } from "@/lib/counts/unified-counts";
import type { DashboardCounts, DashboardStats } from "./hooks/useDashboardData";

// Force dynamic rendering to prevent stale cached menu counts
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // Never cache fetch requests
export const revalidate = 0; // Never revalidate (always fetch fresh)
export const runtime = "nodejs"; // Ensure Node.js runtime

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  
  // CRITICAL: Log IMMEDIATELY - Use multiple methods to ensure visibility
  const timestamp = new Date().toISOString();
  
  // Method 1: console.info
  console.info(`[RAILWAY] =================================================`);
  console.info(`[RAILWAY] Dashboard Server Component - START`);
  console.info(`[RAILWAY] Venue ID: ${venueId}`);
  console.info(`[RAILWAY] Timestamp: ${timestamp}`);
  console.info(`[RAILWAY] =================================================`);
  
  // Method 2: console.log (also captured)
  console.log(`[RAILWAY] Dashboard START - Venue: ${venueId} - Time: ${timestamp}`);
  
  // Method 3: Direct write to stderr (bypasses Next.js)
  if (typeof process !== 'undefined' && process.stderr) {
    process.stderr.write(`[RAILWAY] Dashboard START - Venue: ${venueId}\n`);
  }

  // STEP 1: Server-side auth check (optional - no redirects)
  // NO REDIRECTS - User requested ZERO sign-in redirects
  // Auth check is optional - client will handle auth display
  // Dashboard ALWAYS loads - client handles authentication
  console.info(`[RAILWAY] Starting auth check...`);
  const auth = await requirePageAuth(venueId).catch(() => null);
  console.info(`[RAILWAY] Auth check complete`);

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
      console.info(`[RAILWAY] ❌ ERROR fetching dashboard_counts: ${countsError.message}`);
    } else {
      initialCounts = countsData as DashboardCounts;
      console.info(`[RAILWAY] =================================================`);
      console.info(`[RAILWAY] 📊 DASHBOARD COUNTS FROM DATABASE (RPC)`);
      console.info(`[RAILWAY] =================================================`);
      console.info(`[RAILWAY] Venue ID: ${normalizedVenueId}`);
      console.info(`[RAILWAY] live_count: ${initialCounts?.live_count || 0}`);
      console.info(`[RAILWAY] earlier_today_count: ${initialCounts?.earlier_today_count || 0}`);
      console.info(`[RAILWAY] history_count: ${initialCounts?.history_count || 0}`);
      console.info(`[RAILWAY] today_orders_count: ${initialCounts?.today_orders_count || 0}`);
      console.info(`[RAILWAY] active_tables_count: ${initialCounts?.active_tables_count || 0}`);
      console.info(`[RAILWAY] =================================================`);
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
        
        console.info(`\n[RAILWAY] =================================================\n`);
        console.info(`[RAILWAY] 🪑 TABLES DATA FROM DATABASE\n`);
        console.info(`[RAILWAY] =================================================\n`);
        console.info(`[RAILWAY] Total tables in database: ${totalTables}\n`);
        console.info(`[RAILWAY] Active tables (is_active=true): ${activeTables.length}\n`);
        console.info(`[RAILWAY] Tables in use (OCCUPIED sessions): ${tablesInUse}\n`);
        console.info(`[RAILWAY] Tables reserved now: ${tablesReserved}\n`);
        console.info(`[RAILWAY] ⚠️  tables_set_up will be set to: ${activeTables.length}\n`);
        console.info(`[RAILWAY] =================================================\n`);
        
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
      console.info(`[RAILWAY] ❌ ERROR fetching orders: ${ordersError.message}`);
    } else {
      const totalOrders = orders?.length || 0;
      const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const unpaid = orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER").length || 0;
      
      console.info(`[RAILWAY] =================================================`);
      console.info(`[RAILWAY] 💰 REVENUE & ORDERS DATA FROM DATABASE`);
      console.info(`[RAILWAY] =================================================`);
      console.info(`[RAILWAY] Time Window: ${window.startUtcISO} to ${window.endUtcISO}`);
      console.info(`[RAILWAY] Total orders in time window: ${totalOrders}`);
      console.info(`[RAILWAY] Total revenue: £${revenue.toFixed(2)}`);
      console.info(`[RAILWAY] Unpaid orders: ${unpaid}`);
      console.info(`[RAILWAY] ⚠️  THIS IS THE ACTUAL REVENUE FROM DATABASE: £${revenue.toFixed(2)}`);
      console.info(`[RAILWAY] =================================================`);
    }

    // Use unified count function - single source of truth
    const actualMenuItemCount = await fetchMenuItemCount(venueId);
    
    console.info(`[RAILWAY] =================================================`);
    console.info(`[RAILWAY] 🍽️  MENU ITEMS COUNT FROM DATABASE`);
    console.info(`[RAILWAY] =================================================`);
    console.info(`[RAILWAY] Venue ID: ${normalizedVenueId}`);
    console.info(`[RAILWAY] Menu Items Count: ${actualMenuItemCount}`);
    console.info(`[RAILWAY] =================================================`);

    const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
    const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

    initialStats = {
      revenue,
      menuItems: actualMenuItemCount, // Use actual array length, not count query
      unpaid,
    };
    
    // LOG: Show what's being passed to client - Use multiple methods
    const finalStats = {
      menuItems: initialStats.menuItems,
      revenue: initialStats.revenue,
      unpaid: initialStats.unpaid,
    };
    
    // Method 1: console.info
    console.info(`[RAILWAY] =================================================`);
    console.info(`[RAILWAY] ✅ FINAL DATA BEING PASSED TO CLIENT`);
    console.info(`[RAILWAY] =================================================`);
    console.info(`[RAILWAY] initialStats.menuItems: ${finalStats.menuItems}`);
    console.info(`[RAILWAY] initialStats.revenue: £${finalStats.revenue.toFixed(2)}`);
    console.info(`[RAILWAY] initialStats.unpaid: ${finalStats.unpaid}`);
    console.info(`[RAILWAY] initialCounts.today_orders_count: ${initialCounts?.today_orders_count || 0}`);
    console.info(`[RAILWAY] initialCounts.tables_set_up: ${initialCounts?.tables_set_up || 0}`);
    console.info(`[RAILWAY] initialCounts.live_count: ${initialCounts?.live_count || 0}`);
    console.info(`[RAILWAY] =================================================`);
    
    // Method 2: Single line summary (easy to spot)
    console.info(`[RAILWAY] FINAL COUNTS - Menu: ${finalStats.menuItems} | Tables: ${initialCounts?.tables_set_up || 0} | Revenue: £${finalStats.revenue.toFixed(2)} | Orders: ${initialCounts?.today_orders_count || 0}`);
    
    // Method 3: console.log
    console.log(`[RAILWAY] FINAL COUNTS - Menu: ${finalStats.menuItems} | Tables: ${initialCounts?.tables_set_up || 0} | Revenue: £${finalStats.revenue.toFixed(2)} | Orders: ${initialCounts?.today_orders_count || 0}`);
    
    // Method 4: Direct stderr write
    if (typeof process !== 'undefined' && process.stderr) {
      process.stderr.write(`[RAILWAY] FINAL COUNTS - Menu: ${finalStats.menuItems} | Tables: ${initialCounts?.tables_set_up || 0} | Revenue: £${finalStats.revenue.toFixed(2)} | Orders: ${initialCounts?.today_orders_count || 0}\n`);
    }
  } catch (error) {
    // Log error to Railway - use console.info
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack";
    console.info(`[RAILWAY] ERROR: ${errorMsg}`);
    console.info(`[RAILWAY] ERROR STACK: ${errorStack}`);
    // Continue without initial data - client will load it
  }

  // FINAL SERVER-SIDE LOG - Railway only shows console.info
  const finalCount = initialStats?.menuItems || 0;
  console.info(`[RAILWAY] =================================================`);
  console.info(`[RAILWAY] Dashboard Server Component - END`);
  console.info(`[RAILWAY] Final menuItems count: ${finalCount}`);
  console.info(`[RAILWAY] Final revenue: £${initialStats?.revenue?.toFixed(2) || "0.00"}`);
  console.info(`[RAILWAY] Final tables_set_up: ${initialCounts?.tables_set_up || 0}`);
  console.info(`[RAILWAY] Final today_orders_count: ${initialCounts?.today_orders_count || 0}`);
  console.info(`[RAILWAY] =================================================`);

  return (
    <DashboardClient
      venueId={venueId}
      initialCounts={initialCounts}
      initialStats={initialStats}
    />
  );
}
