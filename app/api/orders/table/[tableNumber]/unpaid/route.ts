import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/table/[tableNumber]/unpaid
 *
 * Fetch all unpaid orders for a specific table
 * Used for "Pay Entire Table" functionality
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tableNumber: string }> }
) {
  try {
    const { tableNumber } = await params;
    const { searchParams } = new URL(_request.url);
    const venueId = searchParams.get("venue_id");

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    if (!tableNumber) {
      return apiErrors.badRequest("tableNumber is required");
    }

    const admin = createAdminClient();

    // Fetch all unpaid orders for this table from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        `
        id,
        venue_id,
        table_number,
        table_id,
        customer_name,
        customer_phone,
        customer_email,
        total_amount,
        payment_status,
        payment_mode,
        payment_method,
        order_status,
        items,
        created_at,
        updated_at,
        source
      `
      )
      .eq("venue_id", venueId)
      .eq("table_number", parseInt(tableNumber))
      .in("payment_status", ["UNPAID"])
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("[TABLE UNPAID ORDERS] Error fetching orders", {
        data: { tableNumber, venueId, error },
      });
      return apiErrors.internal("Failed to fetch orders");
    }

    // Calculate total
    const totalAmount = (orders || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);

    // Group by payment mode
    const ordersByMode = {
      pay_at_till: (orders || []).filter((o) => o.payment_mode === "pay_at_till"),
      pay_later: (orders || []).filter((o) => o.payment_mode === "pay_later"),
      online: (orders || []).filter((o) => o.payment_mode === "online" || !o.payment_mode),
    };

    logger.info("[TABLE UNPAID ORDERS] Fetched unpaid orders", {
      data: {
        tableNumber,
        venueId,
        orderCount: orders?.length || 0,
        totalAmount,
        byMode: {
          pay_at_till: ordersByMode.pay_at_till.length,
          pay_later: ordersByMode.pay_later.length,
          online: ordersByMode.online.length,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      orders: orders || [],
      totalAmount,
      orderCount: orders?.length || 0,
      byPaymentMode: ordersByMode,
    });
  } catch (_error) {
    logger.error("[TABLE UNPAID ORDERS] Unexpected error", {
      data: {
        error: _error instanceof Error ? _error.message : String(_error),
      },
    });
    return apiErrors.internal("Internal server error");
  }
}
