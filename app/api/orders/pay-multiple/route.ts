import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import {
  deriveQrTypeFromOrder,
  normalizePaymentMethod,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/pay-multiple
 *
 * Pay multiple orders at once (e.g., entire table)
 * Handles both till payment and card payment
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
  try {
    const body = await req.json();
    const { order_ids, payment_method, venue_id } = body;

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
      return apiErrors.badRequest("venue_id is required");
    }

    const admin = createAdminClient();

    // Fetch all orders to validate
    const { data: orders, error: fetchError } = await admin
      .from("orders")
      .select("*")
      .in("id", order_ids)
      .eq("venue_id", venue_id);

    if (fetchError || !orders || orders.length === 0) {

      return apiErrors.notFound("Orders not found");
    }

    // Validate all orders are unpaid
    const alreadyPaid = orders.filter((o) => String(o.payment_status || "").toUpperCase() === "PAID");
    if (alreadyPaid.length > 0) {

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

      // Allow it but log warning
    }

    const allowPayAtTillForTableCollection = await admin
      .from("venues")
      .select("allow_pay_at_till_for_table_collection")
      .eq("venue_id", venue_id)
      .maybeSingle()
      .then((result) => result.data?.allow_pay_at_till_for_table_collection === true);

    const normalizedPaymentMethod = normalizePaymentMethod(payment_method) || "PAY_AT_TILL";

    const invalidOrders = orders.filter((order) => {
      const qrType = deriveQrTypeFromOrder(order);
      const validation = validatePaymentMethodForQrType({
        qrType,
        paymentMethod: normalizedPaymentMethod,
        allowPayAtTillForTableCollection,
      });
      return !validation.ok;
    });

    if (invalidOrders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more orders do not allow this payment method.",
          invalid_order_ids: invalidOrders.map((o) => o.id),
        },
        { status: 400 }
      );
    }

    if (!["PAY_AT_TILL", "PAY_LATER"].includes(normalizedPaymentMethod)) {
      return NextResponse.json(
        { error: "Only Pay at Till or Pay Later orders can be confirmed here" },
        { status: 400 }
      );
    }

    // Update all orders to paid
    const { data: updatedOrders, error: updateError } = await admin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: normalizedPaymentMethod,
        paid_at: new Date().toISOString(),
        paid_by_user_id: context.user.id,
        updated_at: new Date().toISOString(),
      })
      .in("id", order_ids)
      .eq("venue_id", venue_id)
      .select("*");

    if (updateError) {

      return apiErrors.internal("Failed to mark orders as paid");
    }

    // Calculate total
    const totalAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    return NextResponse.json({
      ok: true,
      orders: updatedOrders || [],
      totalAmount,
      orderCount: updatedOrders?.length || 0,
      payment_method: normalizedPaymentMethod,
      message: `Successfully marked ${updatedOrders?.length || 0} order(s) as paid`,
    });
  } catch (_error) {

    return apiErrors.internal("Internal server error");
  }
  },
  {
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
  }
);
