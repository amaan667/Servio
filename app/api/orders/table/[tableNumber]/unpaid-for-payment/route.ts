import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/table/[tableNumber]/unpaid-for-payment
 *
 * Fetch all unpaid orders for a specific table for customer payment (QR rescan)
 * This is used when customer rescans QR code to pay for pay_later orders
 * Returns orders in a format suitable for payment screen
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
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    if (!tableNumber) {
      return NextResponse.json({ error: "tableNumber is required" }, { status: 400 });
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
        customer_name,
        customer_phone,
        customer_email,
        total_amount,
        payment_status,
        payment_mode,
        order_status,
        items,
        created_at
      `
      )
      .eq("venue_id", venueId)
      .eq("table_number", parseInt(tableNumber))
      .in("payment_status", ["UNPAID"])
      .in("payment_mode", ["pay_later", "pay_at_till", "online"])
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("[TABLE UNPAID FOR PAYMENT] Error fetching orders", {
        data: { tableNumber, venueId, error },
      });
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Calculate total
    const totalAmount = (orders || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);

    // Group by payment mode for display
    const ordersByMode = {
      pay_later: (orders || []).filter((o) => o.payment_mode === "pay_later"),
      pay_at_till: (orders || []).filter((o) => o.payment_mode === "pay_at_till"),
      online: (orders || []).filter((o) => o.payment_mode === "online" || !o.payment_mode),
    };

    logger.info("[TABLE UNPAID FOR PAYMENT] Fetched unpaid orders", {
      data: {
        tableNumber,
        venueId,
        orderCount: orders?.length || 0,
        totalAmount,
        byMode: {
          pay_later: ordersByMode.pay_later.length,
          pay_at_till: ordersByMode.pay_at_till.length,
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
      tableNumber: parseInt(tableNumber),
      venueId,
    });
  } catch (_error) {
    logger.error("[TABLE UNPAID FOR PAYMENT] Unexpected error", {
      data: {
        error: _error instanceof Error ? _error.message : String(_error),
      },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


