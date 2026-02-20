import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { verifyVenueAccess } from "@/lib/auth/unified-auth";
import { apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";
import {
  deriveQrTypeFromOrder,
  normalizePaymentStatus,
  validateOrderStatusTransition,
} from "@/lib/orders/qr-payment-validation";

const updatePosOrderStatusSchema = z.object({
  order_id: z.string().min(1, "order_id is required"),
  order_status: z.string().min(1, "order_status is required"),
  payment_status: z.string().optional(),
});

export const PATCH = createUnifiedHandler(
  async (req: NextRequest, context) => {
    const { order_id, order_status, payment_status } = context.body as z.infer<
      typeof updatePosOrderStatusSchema
    >;

    const supabase = createAdminClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "venue_id, payment_status, order_status, qr_type, fulfillment_type, source, requires_collection"
      )
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return apiErrors.notFound("Order not found");
    }

    const access = await verifyVenueAccess(order.venue_id, context.user.id, req);
    if (!access) {
      return apiErrors.forbidden("Access denied to this venue");
    }

    const qrType = deriveQrTypeFromOrder(order);
    const normalizedPaymentStatus = normalizePaymentStatus(order.payment_status) || "UNPAID";
    const transitionValidation = validateOrderStatusTransition({
      qrType,
      paymentStatus: normalizedPaymentStatus,
      currentStatus: order.order_status || "",
      nextStatus: order_status,
    });

    if (!transitionValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: transitionValidation.error || "Order status transition not allowed",
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, string> = { order_status };
    if (payment_status) {
      updateData.payment_status = payment_status;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .eq("venue_id", order.venue_id)
      .select()
      .single();

    if (updateError) {
      return apiErrors.internal("Internal server error");
    }

    return { order: updatedOrder };
  },
  {
    schema: updatePosOrderStatusSchema,
    requireAuth: true,
    requireVenueAccess: false,
  }
);
