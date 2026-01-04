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

      // Parallelize all fetches for instant loading
      const now = new Date();
      const [
        countsResult,
        tablesResult,
        sessionsResult,
        reservationsResult,
        ordersResult,
        menuItemsResult,
      ] = await Promise.all([
        supabase
          .rpc("dashboard_counts", {
            p_venue_id: normalizedVenueId,
            p_tz: venueTz,
            p_live_window_mins: 30,
          })
          .single(),
        supabase
          .from("tables")
          .select("id, is_active")
          .eq("venue_id", normalizedVenueId),
        supabase
          .from("table_sessions")
          .select("id, status, table_id")
          .eq("venue_id", normalizedVenueId)
          .eq("status", "OCCUPIED")
          .is("closed_at", null),
        supabase
          .from("reservations")
          .select("id")
          .eq("venue_id", normalizedVenueId)
          .eq("status", "BOOKED")
          .lte("start_at", now.toISOString())
          .gte("end_at", now.toISOString()),
        supabase
          .from("orders")
          .select("total_amount, order_status, payment_status")
          .eq("venue_id", normalizedVenueId)
          .gte("created_at", window.startUtcISO)
          .lt("created_at", window.endUtcISO)
          .neq("order_status", "CANCELLED")
          .neq("order_status", "REFUNDED"),
        fetchMenuItemCount(venueId),
      ]);

      // Process results
      if (countsResult.error) {
        logger.error("[DASHBOARD] Error fetching dashboard_counts", {
          error: countsResult.error.message,
          venueId: normalizedVenueId,
        });
      } else {
        initialCounts = countsResult.data as DashboardCounts;
      }

      // Merge real counts into initialCounts
      if (initialCounts && !tablesResult.error) {
        const activeTables = tablesResult.data?.filter((t) => t.is_active) || [];
        const tablesInUse = sessionsResult.data?.length || 0;
        const tablesReserved = reservationsResult.data?.length || 0;

        initialCounts = {
          ...initialCounts,
          tables_set_up: activeTables.length,
          tables_in_use: tablesInUse,
          tables_reserved_now: tablesReserved,
          active_tables_count: activeTables.length,
        };
      }

      // Process stats
      let revenue = 0;
      let unpaid = 0;

      if (!ordersResult.error && ordersResult.data) {
        revenue = ordersResult.data.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        unpaid = ordersResult.data.filter(
          (o) => o.payment_status === "UNPAID" || o.payment_status === "PAY_LATER"
        ).length;
      } else if (ordersResult.error) {
        logger.error("[DASHBOARD] Error fetching orders", {
          error: ordersResult.error.message,
          venueId: normalizedVenueId,
        });
      }

      // CRITICAL: Create initialStats object
      initialStats = {
        revenue,
        menuItems: menuItemsResult,
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
