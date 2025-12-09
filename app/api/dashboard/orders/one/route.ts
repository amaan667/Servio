export const runtime = "nodejs";

import { success, apiErrors } from '@/lib/api/standard-response';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { NextRequest } from 'next/server';

/**
 * Get orders for a venue with scope filtering
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only access orders for venues they have access to.
 */
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const url = new URL(req.url);
    // scope: 'live' (last 30 minutes) | 'earlier' (today but more than 30 min ago) | 'history' (yesterday and earlier)
    const scope = (url.searchParams.get("scope") || "live") as "live" | "earlier" | "history";

    // venueId comes from context (already verified by withUnifiedAuth)
    const venueId = context.venueId;

    try {
      // Use authenticated client that respects RLS (not admin client)
      // RLS policies ensure users can only access orders for venues they have access to
      const supabase = await createClient();

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
        meta: { scope, zone: "Europe/London", count: transformedOrders?.length ?? 0 },
      });
    } catch (_e) {
      const errorMessage = _e instanceof Error ? _e.message : "Unknown error";
      logger.error("[DASHBOARD ORDERS ONE] Unexpected error", {
        error: errorMessage,
        venueId,
        userId: context.user.id,
      });
      return apiErrors.internal(errorMessage);
    }
  }
);
