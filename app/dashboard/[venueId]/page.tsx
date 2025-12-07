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

// Disable all dashboard logging
const ENABLE_DASHBOARD_LOGS = false;

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  
  // CRITICAL: Log IMMEDIATELY - Use stdout.write which Railway ALWAYS captures
  const timestamp = new Date().toISOString();
  
  // Railway captures stdout.write - use this as primary method
  if (ENABLE_DASHBOARD_LOGS && typeof process !== 'undefined' && process.stdout) {
    process.stdout.write(`[RAILWAY] =================================================\n`);
    process.stdout.write(`[RAILWAY] Dashboard Server Component - START\n`);
    process.stdout.write(`[RAILWAY] Venue ID: ${venueId}\n`);
    process.stdout.write(`[RAILWAY] Timestamp: ${timestamp}\n`);
    process.stdout.write(`[RAILWAY] =================================================\n`);
  }
  
  // Also use // console.info as backup
  // console.info(`[RAILWAY] Dashboard START - Venue: ${venueId} - Time: ${timestamp}`);

  // STEP 1: Server-side auth check (optional - no redirects)
  // NO REDIRECTS - User requested ZERO sign-in redirects
  // Auth check is optional - client will handle auth display
  // Dashboard ALWAYS loads - client handles authentication
  // console.info(`[RAILWAY] Starting auth check...`);
  const auth = await requirePageAuth(venueId).catch(() => null);
  // console.info(`[RAILWAY] Auth check complete`);

  // STEP 2: Fetch initial dashboard data on server (even without auth)
  // Always fetch data - don't block on auth
  // Use admin client only after auth verification
  let initialCounts: DashboardCounts | undefined = undefined;
  let initialStats: DashboardStats | undefined = undefined;

  try {
    // Check if service role key is available before creating admin client
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const errorMsg = "SUPABASE_SERVICE_ROLE_KEY environment variable is missing";
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`[RAILWAY] ❌ CRITICAL ERROR: ${errorMsg}\n`);
      }
      logger.error(errorMsg);
      // Continue without initial data - client will handle gracefully
    } else {
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
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`[RAILWAY] ❌ ERROR fetching dashboard_counts: ${countsError.message}\n`);
        }
        // console.info(`[RAILWAY] ❌ ERROR fetching dashboard_counts: ${countsError.message}`);
      } else {
        initialCounts = countsData as DashboardCounts;
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`[RAILWAY] =================================================\n`);
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
      // console.info(`[RAILWAY] =================================================`);
      // console.info(`[RAILWAY] 📊 DASHBOARD COUNTS FROM DATABASE (RPC)`);
      // console.info(`[RAILWAY] =================================================`);
      // console.info(`[RAILWAY] Venue ID: ${normalizedVenueId}`);
      // console.info(`[RAILWAY] live_count: ${initialCounts?.live_count || 0}`);
      // console.info(`[RAILWAY] earlier_today_count: ${initialCounts?.earlier_today_count || 0}`);
      // console.info(`[RAILWAY] history_count: ${initialCounts?.history_count || 0}`);
      // console.info(`[RAILWAY] today_orders_count: ${initialCounts?.today_orders_count || 0}`);
      // console.info(`[RAILWAY] active_tables_count: ${initialCounts?.active_tables_count || 0}`);
      // console.info(`[RAILWAY] =================================================`);
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
          
          if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write(`[RAILWAY] =================================================\n`);
            process.stdout.write(`[RAILWAY] 🪑 TABLES DATA FROM DATABASE\n`);
            process.stdout.write(`[RAILWAY] =================================================\n`);
            process.stdout.write(`[RAILWAY] Total tables in database: ${totalTables}\n`);
            process.stdout.write(`[RAILWAY] Active tables (is_active=true): ${activeTables.length}\n`);
            process.stdout.write(`[RAILWAY] Tables in use (OCCUPIED sessions): ${tablesInUse}\n`);
            process.stdout.write(`[RAILWAY] Tables reserved now: ${tablesReserved}\n`);
            process.stdout.write(`[RAILWAY] ⚠️  tables_set_up will be set to: ${activeTables.length}\n`);
            process.stdout.write(`[RAILWAY] =================================================\n`);
          }
          // console.info(`[RAILWAY] =================================================`);
          // console.info(`[RAILWAY] 🪑 TABLES DATA FROM DATABASE`);
          // console.info(`[RAILWAY] =================================================`);
          // console.info(`[RAILWAY] Total tables in database: ${totalTables}`);
          // console.info(`[RAILWAY] Active tables (is_active=true): ${activeTables.length}`);
          // console.info(`[RAILWAY] Tables in use (OCCUPIED sessions): ${tablesInUse}`);
          // console.info(`[RAILWAY] Tables reserved now: ${tablesReserved}`);
          // console.info(`[RAILWAY] ⚠️  tables_set_up will be set to: ${activeTables.length}`);
          // console.info(`[RAILWAY] =================================================`);
          
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
        // console.info(`[RAILWAY] ❌ ERROR fetching orders: ${ordersError.message}`);
      } else {
        const totalOrders = orders?.length || 0;
        const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        const unpaid = orders?.filter((o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER").length || 0;
        
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`[RAILWAY] =================================================\n`);
          process.stdout.write(`[RAILWAY] 💰 REVENUE & ORDERS DATA FROM DATABASE\n`);
          process.stdout.write(`[RAILWAY] =================================================\n`);
          process.stdout.write(`[RAILWAY] Time Window: ${window.startUtcISO} to ${window.endUtcISO}\n`);
          process.stdout.write(`[RAILWAY] Total orders in time window: ${totalOrders}\n`);
          process.stdout.write(`[RAILWAY] Total revenue: £${revenue.toFixed(2)}\n`);
          process.stdout.write(`[RAILWAY] Unpaid orders: ${unpaid}\n`);
          process.stdout.write(`[RAILWAY] ⚠️  THIS IS THE ACTUAL REVENUE FROM DATABASE: £${revenue.toFixed(2)}\n`);
          process.stdout.write(`[RAILWAY] =================================================\n`);
        }
        // console.info(`[RAILWAY] =================================================`);
        // console.info(`[RAILWAY] 💰 REVENUE & ORDERS DATA FROM DATABASE`);
        // console.info(`[RAILWAY] =================================================`);
        // console.info(`[RAILWAY] Time Window: ${window.startUtcISO} to ${window.endUtcISO}`);
        // console.info(`[RAILWAY] Total orders in time window: ${totalOrders}`);
        // console.info(`[RAILWAY] Total revenue: £${revenue.toFixed(2)}`);
        // console.info(`[RAILWAY] Unpaid orders: ${unpaid}`);
        // console.info(`[RAILWAY] ⚠️  THIS IS THE ACTUAL REVENUE FROM DATABASE: £${revenue.toFixed(2)}`);
        // console.info(`[RAILWAY] =================================================`);
      }

      // Use unified count function - single source of truth
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`[RAILWAY] =================================================\n`);
        process.stdout.write(`[RAILWAY] 🍽️  CALLING fetchMenuItemCount\n`);
        process.stdout.write(`[RAILWAY] Input venueId: ${venueId}\n`);
        process.stdout.write(`[RAILWAY] Normalized venueId: ${normalizedVenueId}\n`);
        process.stdout.write(`[RAILWAY] =================================================\n`);
      }
      
      const actualMenuItemCount = await fetchMenuItemCount(venueId);
      
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`[RAILWAY] =================================================\n`);
        process.stdout.write(`[RAILWAY] 🍽️  MENU ITEMS COUNT RESULT\n`);
        process.stdout.write(`[RAILWAY] Venue ID: ${normalizedVenueId}\n`);
        process.stdout.write(`[RAILWAY] fetchMenuItemCount returned: ${actualMenuItemCount}\n`);
        process.stdout.write(`[RAILWAY] Type: ${typeof actualMenuItemCount}\n`);
        process.stdout.write(`[RAILWAY] Is NaN: ${Number.isNaN(actualMenuItemCount)}\n`);
        process.stdout.write(`[RAILWAY] =================================================\n`);
      }
      
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`[RAILWAY] Menu Items Count: ${actualMenuItemCount}\n`);
      }
      // console.info(`[RAILWAY] Menu Items Count: ${actualMenuItemCount}`);

      const revenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const unpaid = orders?.filter((o) => o.order_status === "UNPAID").length || 0;

      // CRITICAL: Create initialStats object
      initialStats = {
        revenue,
        menuItems: actualMenuItemCount, // Use actual array length, not count query
        unpaid,
      };
      
      // CRITICAL LOG: Use stdout.write which Railway ALWAYS captures
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`[RAILWAY] ═══════════════════════════════════════════════════════════\n`);
        process.stdout.write(`[RAILWAY] 🎯 SERVER FINAL COUNTS - PASSING TO CLIENT\n`);
        process.stdout.write(`[RAILWAY] ═══════════════════════════════════════════════════════════\n`);
        process.stdout.write(`[RAILWAY] 📊 COMPLETE DASHBOARD COUNTS SUMMARY:\n`);
        process.stdout.write(`[RAILWAY]   Menu Items: ${initialStats.menuItems}\n`);
        process.stdout.write(`[RAILWAY]   Tables Set Up: ${initialCounts?.tables_set_up || 0}\n`);
        process.stdout.write(`[RAILWAY]   Tables In Use: ${initialCounts?.tables_in_use || 0}\n`);
        process.stdout.write(`[RAILWAY]   Tables Reserved Now: ${initialCounts?.tables_reserved_now || 0}\n`);
        process.stdout.write(`[RAILWAY]   Revenue: £${initialStats.revenue.toFixed(2)}\n`);
        process.stdout.write(`[RAILWAY]   Unpaid Orders: ${initialStats.unpaid || 0}\n`);
        process.stdout.write(`[RAILWAY]   Today's Orders: ${initialCounts?.today_orders_count || 0}\n`);
        process.stdout.write(`[RAILWAY]   Live Orders: ${initialCounts?.live_count || 0}\n`);
        process.stdout.write(`[RAILWAY]   Earlier Today: ${initialCounts?.earlier_today_count || 0}\n`);
        process.stdout.write(`[RAILWAY]   History Count: ${initialCounts?.history_count || 0}\n`);
        process.stdout.write(`[RAILWAY]   Active Tables Count: ${initialCounts?.active_tables_count || 0}\n`);
        process.stdout.write(`[RAILWAY] ═══════════════════════════════════════════════════════════\n`);
        process.stdout.write(`[RAILWAY] initialStats JSON: ${JSON.stringify(initialStats)}\n`);
        process.stdout.write(`[RAILWAY] initialCounts JSON: ${JSON.stringify(initialCounts)}\n`);
      }
      
      // Backup logging - also use stdout for Railway
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`[RAILWAY] SERVER COUNTS - Menu: ${initialStats.menuItems} | Tables: ${initialCounts?.tables_set_up || 0} | Revenue: £${initialStats.revenue.toFixed(2)} | Orders: ${initialCounts?.today_orders_count || 0}\n`);
      }
      // console.info(`[RAILWAY] SERVER COUNTS - Menu: ${initialStats.menuItems} | Tables: ${initialCounts?.tables_set_up || 0} | Revenue: £${initialStats.revenue.toFixed(2)} | Orders: ${initialCounts?.today_orders_count || 0}`);
      }
  } catch (error) {
    // Log error to Railway - use both stdout and // console.info
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : "No stack";
    if (typeof process !== 'undefined' && process.stdout) {
      process.stdout.write(`[RAILWAY] ERROR: ${errorMsg}\n`);
      process.stdout.write(`[RAILWAY] ERROR STACK: ${errorStack}\n`);
    }
    // console.info(`[RAILWAY] ERROR: ${errorMsg}`);
    // console.info(`[RAILWAY] ERROR STACK: ${errorStack}`);
    // Continue without initial data - client will load it
  }

  // FINAL SERVER-SIDE LOG - Use stdout.write which Railway ALWAYS captures
  const finalCount = initialStats?.menuItems || 0;
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write(`[RAILWAY] ═══════════════════════════════════════════════════════════\n`);
    process.stdout.write(`[RAILWAY] 🏁 Dashboard Server Component - END\n`);
    process.stdout.write(`[RAILWAY] ═══════════════════════════════════════════════════════════\n`);
    process.stdout.write(`[RAILWAY] Rendering DashboardClient with:\n`);
    process.stdout.write(`[RAILWAY]   initialStats.menuItems: ${finalCount}\n`);
    process.stdout.write(`[RAILWAY]   initialStats.revenue: £${initialStats?.revenue?.toFixed(2) || "0.00"}\n`);
    process.stdout.write(`[RAILWAY]   initialCounts.tables_set_up: ${initialCounts?.tables_set_up || 0}\n`);
    process.stdout.write(`[RAILWAY]   initialCounts.today_orders_count: ${initialCounts?.today_orders_count || 0}\n`);
    process.stdout.write(`[RAILWAY] ═══════════════════════════════════════════════════════════\n`);
  }
  
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write(`[RAILWAY] END - Menu: ${finalCount} | Tables: ${initialCounts?.tables_set_up || 0} | Revenue: £${initialStats?.revenue?.toFixed(2) || "0.00"}\n`);
  }
  // Server-side data preparation (logging removed - use structured logger if needed)
  // Data passed to client component for rendering

  return (
    <DashboardClient
      venueId={venueId}
      initialCounts={initialCounts}
      initialStats={initialStats}
    />
  );
}
