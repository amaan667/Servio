import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors, success } from "@/lib/api/standard-response";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  deriveQrTypeFromOrder,
  normalizePaymentMethod,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const payMultipleSchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1, "At least one order ID is required"),
  payment_method: z.enum(["cash", "card", "till"]),
  venue_id: z.string(),
});

/**
 * POST /api/orders/pay-multiple
 *
 * Pay multiple orders at once (e.g., entire table)
 * Handles both till payment and card payment
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body } = context;
    const { order_ids, payment_method, venue_id } = body;

    // Validation already done by unified handler schema

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
    const alreadyPaid = orders.filter(
      (o) => String(o.payment_status || "").toUpperCase() === "PAID"
    );
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

    return success({
      ok: true,
      orders: updatedOrders || [],
      totalAmount,
      orderCount: updatedOrders?.length || 0,
      payment_method: normalizedPaymentMethod,
      message: `Successfully marked ${updatedOrders?.length || 0} order(s) as paid`,
    });
  },
  {
    schema: payMultipleSchema,
    requireVenueAccess: true,
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const body = await req.clone().json();
        return body?.venue_id || null;
      } catch {
        return null;
      }
    },
  }
);
