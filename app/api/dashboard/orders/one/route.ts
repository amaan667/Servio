export const runtime = "nodejs";

import { success, apiErrors } from '@/lib/api/standard-response';
import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

type OrderRow = {
  id: string;
  venue_id: string;
  table_number: number | null;
  customer_name: string | null;
  items: unknown[]; // jsonb[]
  total_amount: number;
  created_at: string; // timestamptz
  order_status: "pending" | "preparing" | "served" | "delivered" | "cancelled";
  payment_status: "paid" | "unpaid" | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const venueId = url.searchParams.get("venueId");
  // scope: 'live' (last 30 minutes) | 'earlier' (today but more than 30 min ago) | 'history' (yesterday and earlier)
  const scope = (url.searchParams.get("scope") || "live") as "live" | "earlier" | "history";

  try {
    if (!venueId) {
      return apiErrors.badRequest('venueId required');
    }

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.user || !auth.supabase) {
      return apiErrors.unauthorized(auth.error || "Authentication required");
    }

    const { user, supabase } = auth;

    // Verify venue access
    const access = await verifyVenueAccess(supabase, user.id, venueId);
    if (!access.hasAccess) {
      return apiErrors.forbidden('Access denied');
    }

    // Use default timezone since venues table doesn't have timezone column
    const zone = "Europe/London";

    // base query: always sort by created_at DESC  ✅ (Requirement #2)
    let q = supabase
      .from("orders")
      .select(
        `
        id, venue_id, table_number, table_id, customer_name, items, total_amount, created_at, order_status, payment_status, source,
        tables!left (
          id,
          label,
          area
        )
      `
      )
      .eq("venue_id", venueId)
      .in("payment_status", ["PAID", "UNPAID"]) // Show both paid and unpaid orders
      .order("created_at", { ascending: false });

    if (scope === "live") {
      // Live orders: last 30 minutes only
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      q = q.gte("created_at", thirtyMinutesAgo.toISOString());
    } else if (scope === "earlier") {
      // Earlier today: orders from today but more than 30 minutes ago
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      q = q
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", thirtyMinutesAgo.toISOString());
    } else if (scope === "history") {
      // History: orders from yesterday and earlier
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      q = q.lt("created_at", todayStart.toISOString()).limit(500);
    }

    const { data, error } = await q;
    if (error) {
      logger.error("[DASHBOARD ORDERS ONE] Database error", {
        error: error.message,
        venueId,
        scope,
      });
      return apiErrors.database(error.message);
    }

    // Transform orders to include table_label
    const transformedOrders =
      data?.map((order: Record<string, unknown>) => ({
        ...(order as Record<string, unknown>),
        table_label:
          (order.tables as { label?: string } | null | undefined)?.label ||
          (order.source === "counter"
            ? `Counter ${order.table_number}`
            : `Table ${order.table_number}`) ||
          null,
      })) || [];

    // Detailed logging for Railway deployment monitoring (disabled for performance)
    // if (data && data.length > 0) {
    //   // Age distribution analysis
    //   const ageDistribution = data.reduce((acc, order) => {
    //     const orderDate = new Date(order.created_at);
    //     const ageMinutes = Math.round((Date.now() - orderDate.getTime()) / (1000 * 60));
    //     if (ageMinutes < 30) acc['<30min'] = (acc['<30min'] || 0) + 1;
    //     else if (ageMinutes < 60) acc['30-60min'] = (acc['30-60min'] || 0) + 1;
    //     else if (ageMinutes < 1440) acc['1-24hrs'] = (acc['1-24hrs'] || 0) + 1;
    //     else acc['>24hrs'] = (acc['>24hrs'] || 0) + 1;
    //     return acc;
    //   }, { /* Empty */ } as Record<string, number>);
    //
    //
    //   // Status distribution
    //   const statusDistribution = data.reduce((acc, order) => {
    //     acc[order.order_status] = (acc[order.order_status] || 0) + 1;
    //     return acc;
    //   }, { /* Empty */ } as Record<string, number>);
    //
    // }

    return success({
      orders: transformedOrders || [],
      meta: { scope, zone, count: transformedOrders?.length ?? 0 },
    });
  } catch (_e) {
    const errorMessage = _e instanceof Error ? _e.message : "Unknown error";
    logger.error("[DASHBOARD ORDERS ONE] Unexpected error", {
      error: errorMessage,
      venueId,
    });
    return apiErrors.internal(errorMessage);
  }
}
