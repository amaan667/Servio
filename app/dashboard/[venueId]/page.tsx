import React from "react";
import DashboardClient from "./page.client";
import ClientOnlyWrapper from "@/components/ClientOnlyWrapper";
import { createAdminClient } from "@/lib/supabase";
import { getDashboardCounts } from "@/lib/dashboard-counts";
import { todayWindowForTZ } from "@/lib/time";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { fetchMenuItemCount } from "@/lib/counts/unified-counts";
import type { DashboardCounts, DashboardStats } from "./hooks/useDashboardData";
import { normalizeVenueId } from "@/lib/utils/venueId";

// TEMPORARILY DISABLE SSR TO DEBUG TIER ISSUES
// Force client-side rendering only
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function VenuePage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;

  // Log dashboard page load attempt

  // STEP 1: Server-side auth check
  const auth = await getAuthContext(venueId);

  // Guard: enforce venue access. DB is source of truth; missing role = no access.
  // Do not fetch data when user has no role for this venue (cross-tenant protection).
  if (auth.isAuthenticated && auth.role == null) {
    if (process.env.NODE_ENV !== "production") {
       
      console.debug("[auth-diagnostic] dashboard venue access denied", {
        user_id: auth.userId,
        venue_id: venueId,
        role: auth.role,
        tier: auth.tier,
      });
    }
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-muted-foreground">You do not have access to this venue.</p>
        </div>
      </div>
    );
  }

  // Log all auth information for browser console
  const authInfo = {
    hasAuth: auth.isAuthenticated,
    userId: auth.userId,
    email: auth.email,
    tier: auth.tier ?? "starter",
    role: auth.role ?? "viewer",
    venueId: auth.venueId ?? venueId,
    timestamp: new Date().toISOString(),
    page: "Dashboard",
  };

  // STEP 2: Fetch initial dashboard data on server (only when user has venue access)
  // Guard above ensures we only reach here when auth.role is set or user is unauthenticated.
  // For unauthenticated, we still allow load so client can show sign-in; no sensitive data without role.
  let initialCounts: DashboardCounts | undefined = undefined;
  let initialStats: DashboardStats | undefined = undefined;

  const mayFetchData = auth.isAuthenticated && auth.role != null;

  try {
    if (!mayFetchData) {
      // Do not run admin client or fetch venue data when user has no role for this venue
    } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const errorMsg = "SUPABASE_SERVICE_ROLE_KEY environment variable is missing";
    } else {
      const supabase = createAdminClient();
      const venueTz = undefined;
      const window = todayWindowForTZ(venueTz);

      // Normalize venueId format - database stores with venue- prefix
      const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

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
        getDashboardCounts(supabase, {
          venueId: normalizedVenueId,
          tz: venueTz,
          liveWindowMins: 30,
        }).then((c) => ({ data: c, error: null })),
        supabase.from("tables").select("id, is_active").eq("venue_id", normalizedVenueId),
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
        /* Condition handled */
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
        /* Condition handled */
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
            if (typeof window !== 'undefined' && window.__NEXT_DATA__) { /* Condition handled */ }
          `,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__PLATFORM_AUTH__ = ${JSON.stringify(authInfo)};`,
        }}
      />
      <ClientOnlyWrapper
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-servio-purple"></div>
          </div>
        }
      >
        <DashboardClient
          venueId={venueId}
          initialCounts={initialCounts}
          initialStats={initialStats}
        />
      </ClientOnlyWrapper>
    </>
  );
}

// Log when this module is loaded
