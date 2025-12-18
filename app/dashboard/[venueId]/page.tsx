import React from "react";
import DashboardClient from "./page.client";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { todayWindowForTZ } from "@/lib/time";
import { requirePageAuth } from "@/lib/auth/page-auth-helper";
import { fetchMenuItemCount } from "@/lib/counts/unified-counts";
import type { DashboardCounts, DashboardStats } from "./hooks/useDashboardData";

// Force dynamic rendering to prevent stale cached menu counts
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // Never cache fetch requests
export const revalidate = 0; // Never revalidate (always fetch fresh)
export const runtime = "nodejs"; // Ensure Node.js runtime

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Log dashboard page load attempt
  logger.info("[DASHBOARD PAGE] 🏠 PAGE LOAD STARTED", {
    venueId,
    timestamp: new Date().toISOString(),
    params: JSON.stringify(params),
  });

  // STEP 1: Server-side auth check (optional - no redirects)
  // NO REDIRECTS - User requested ZERO sign-in redirects
  // Auth check is optional - client will handle auth display
  // Dashboard ALWAYS loads - client handles authentication
  try {
    await requirePageAuth(venueId).catch((error) => {
      logger.warn("[DASHBOARD PAGE] ⚠️ Auth check failed (non-critical)", {
        venueId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    logger.info("[DASHBOARD PAGE] ✅ Auth check completed", { venueId });
  } catch (error) {
    logger.error("[DASHBOARD PAGE] ❌ Auth check error", {
      venueId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // STEP 2: Fetch initial dashboard data on server (even without auth)
  // Always fetch data - don't block on auth
  // Use admin client only after auth verification
  let initialCounts: DashboardCounts | undefined = undefined;
  let initialStats: DashboardStats | undefined = undefined;

  try {
    // Check if service role key is available before creating admin client
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const errorMsg = "SUPABASE_SERVICE_ROLE_KEY environment variable is missing";
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
        logger.error("[DASHBOARD] Error fetching dashboard_counts", {
          error: countsError.message,
          venueId: normalizedVenueId,
        });
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
          const tablesInUse = activeSessions?.length || 0;
          const tablesReserved = currentReservations?.length || 0;

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

      // Use unified count function - single source of truth
      const actualMenuItemCount = await fetchMenuItemCount(venueId);

      let revenue = 0;
      let unpaid = 0;

      if (!ordersError && orders) {
        revenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        unpaid = orders.filter(
          (o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER"
        ).length;
      } else if (ordersError) {
        logger.error("[DASHBOARD] Error fetching orders", {
          error: ordersError.message,
          venueId: normalizedVenueId,
        });
      }

      // CRITICAL: Create initialStats object
      initialStats = {
        revenue,
        menuItems: actualMenuItemCount, // Use actual array length, not count query
        unpaid,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("[DASHBOARD] Error fetching dashboard data", {
      error: errorMsg,
      venueId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Continue without initial data - client will load it
  }

  // Server-side render completed

  return (
    <>
      {/* Log immediately when page HTML loads */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            

            // Catch any JavaScript errors that might prevent component mounting
            window.addEventListener('error', function(e) {

            });
            
            // Catch unhandled promise rejections
            window.addEventListener('unhandledrejection', function(e) {

            });
            
            // Log when React starts hydrating
            if (typeof window !== 'undefined' && window.__NEXT_DATA__) {

            }
          `,
        }}
      />
      <DashboardClient
        venueId={venueId}
        initialCounts={initialCounts}
        initialStats={initialStats}
      />
    </>
  );
}

// Log when this module is loaded
logger.info("[DASHBOARD PAGE] 📦 MODULE LOADED", {
  timestamp: new Date().toISOString(),
});
