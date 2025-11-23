import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/pay-multiple
 *
 * Pay multiple orders at once (e.g., entire table)
 * Handles both till payment and card payment
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_ids, payment_method, venue_id } = body;

    logger.info("[PAY MULTIPLE] Processing payment for multiple orders", {
      data: { orderCount: order_ids?.length || 0, payment_method, venue_id },
    });

    // Validation
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: "order_ids array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!payment_method || !["cash", "card", "till"].includes(payment_method)) {
      return NextResponse.json(
        { error: "payment_method must be 'cash', 'card', or 'till'" },
        { status: 400 }
      );
    }

    if (!venue_id) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch all orders to validate
    const { data: orders, error: fetchError } = await admin
      .from("orders")
      .select("*")
      .in("id", order_ids)
      .eq("venue_id", venue_id);

    if (fetchError || !orders || orders.length === 0) {
      logger.error("[PAY MULTIPLE] Orders not found", {
        data: { order_ids, venue_id, error: fetchError },
      });
      return NextResponse.json({ error: "Orders not found" }, { status: 404 });
    }

    // Validate all orders are unpaid
    const alreadyPaid = orders.filter((o) => o.payment_status === "PAID");
    if (alreadyPaid.length > 0) {
      logger.warn("[PAY MULTIPLE] Some orders already paid", {
        data: { alreadyPaid: alreadyPaid.map((o) => o.id) },
      });
      return NextResponse.json(
        {
          error: `Some orders are already paid: ${alreadyPaid.map((o) => o.id.slice(-6)).join(", ")}`,
          alreadyPaid: alreadyPaid.map((o) => o.id),
        },
        { status: 400 }
      );
    }

    // Validate all orders are from same table (optional but recommended)
    const tableNumbers = [...new Set(orders.map((o) => o.table_number).filter(Boolean))];
    if (tableNumbers.length > 1) {
      logger.warn("[PAY MULTIPLE] Orders from different tables", {
        data: { tableNumbers },
      });
      // Allow it but log warning
    }

    // Update all orders to paid
    const { data: updatedOrders, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: payment_method === "till" ? "till" : payment_method,
        updated_at: new Date().toISOString(),
      })
      .in("id", order_ids)
      .eq("venue_id", venue_id)
      .select("*");

    if (updateError) {
      logger.error("[PAY MULTIPLE] Failed to update orders", {
        data: { order_ids, error: updateError },
      });
      return NextResponse.json({ error: "Failed to mark orders as paid" }, { status: 500 });
    }

    // Calculate total
    const totalAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    logger.info("[PAY MULTIPLE] Successfully paid multiple orders", {
      data: {
        orderCount: updatedOrders?.length || 0,
        totalAmount,
        payment_method,
        tableNumber: tableNumbers[0] || null,
      },
    });

    return NextResponse.json({
      ok: true,
      orders: updatedOrders || [],
      totalAmount,
      orderCount: updatedOrders?.length || 0,
      payment_method,
      message: `Successfully marked ${updatedOrders?.length || 0} order(s) as paid`,
    });
  } catch (_error) {
    logger.error("[PAY MULTIPLE] Unexpected error", {
      data: {
        error: _error instanceof Error ? _error.message : String(_error),
      },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

