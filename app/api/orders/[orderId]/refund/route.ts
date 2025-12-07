import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getStripeClient } from "@/lib/stripe-client";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { logger } from "@/lib/logger";
import { withStripeRetry } from "@/lib/stripe-retry";
import type Stripe from "stripe";
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    const { orderId } = await context.params;
    const body = await req.json().catch(() => {
      return {};
    });
    const { amount, reason } = body as { amount?: number; reason?: string };

    if (!orderId) {
      return apiErrors.badRequest("Order ID is required");
    }

    const supabase = createAdminClient();
    const stripe = getStripeClient();

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return apiErrors.notFound("Order not found");
    }

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", order.venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", order.venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return apiErrors.forbidden("Forbidden");
    }

    // Check if order was paid via Stripe
    if (!order.stripe_payment_intent_id && !order.stripe_session_id) {
      return apiErrors.badRequest(
        "Order was not paid via Stripe. Cannot process refund.",
        { payment_method: order.payment_method }
      );
    }

    // Check if order is already refunded
    if (order.payment_status === "REFUNDED") {
      return apiErrors.badRequest("Order is already refunded");
    }

    // Determine refund amount (full or partial)
    const refundAmount = amount ? Math.round(amount * 100) : null; // Convert to pence
    const orderAmount = Math.round((order.total_amount || 0) * 100);

    if (refundAmount && refundAmount > orderAmount) {
      return apiErrors.badRequest("Refund amount cannot exceed order total");
    }

    // Get payment intent ID
    let paymentIntentId = order.stripe_payment_intent_id;

    // If no payment intent, try to get it from session
    if (!paymentIntentId && order.stripe_session_id) {
      try {
        const session = await withStripeRetry(
          () => stripe.checkout.sessions.retrieve(order.stripe_session_id!),
          { maxRetries: 2 }
        );
        paymentIntentId = session.payment_intent as string | null;
      } catch (sessionError) {
        logger.error("[REFUND] Failed to retrieve Stripe session", {
          error: sessionError instanceof Error ? sessionError.message : "Unknown error",
        });
        return apiErrors.internal("Failed to retrieve payment information");
      }
    }

    if (!paymentIntentId) {
      return apiErrors.badRequest("No payment intent found for this order");
    }

    // Create refund via Stripe
    try {
      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason: reason ? (reason as Stripe.RefundCreateParams["reason"]) : undefined,
      };

      if (refundAmount) {
        refundParams.amount = refundAmount;
      }

      const refund = await withStripeRetry(
        () => stripe.refunds.create(refundParams),
        { maxRetries: 3 }
      );

      logger.info("[REFUND] Stripe refund created:", {
        refundId: refund.id,
        orderId,
        amount: refund.amount,
        status: refund.status,
      });

      // Update order payment status
      const isPartialRefund = refundAmount && refundAmount < orderAmount;
      const newPaymentStatus = isPartialRefund ? "PARTIALLY_REFUNDED" : "REFUNDED";

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_status: newPaymentStatus,
          refund_amount: refundAmount ? refundAmount / 100 : order.total_amount,
          refund_id: refund.id,
          refund_reason: reason || null,
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        logger.error("[REFUND] Failed to update order", { error: updateError.message });
        // Refund was successful in Stripe, but DB update failed
        // This is a critical issue - log it but don't fail the request
        return success({
            warning: "Refund processed but order update failed",
            refund_id: refund.id,
            error: updateError.message,
        });
      }

      return success({
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
          payment_status: newPaymentStatus,
        },
        order_id: orderId,
      });
    } catch (stripeError) {
      logger.error("[REFUND] Stripe refund failed:", {
        error: stripeError instanceof Error ? stripeError.message : "Unknown error",
        orderId,
        paymentIntentId,
      });

      if (stripeError instanceof Error && stripeError.message.includes("already been refunded")) {
        // Order was already refunded in Stripe but not in our DB
        // Update our DB to match Stripe
        await supabase
          .from("orders")
          .update({
            payment_status: "REFUNDED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        return apiErrors.badRequest("Order was already refunded in Stripe");
      }

      const errorMessage = stripeError instanceof Error ? stripeError.message : "Unknown error";
      return apiErrors.internal("Failed to process refund", errorMessage);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[REFUND] Unexpected error", {
      error: errorMessage,
    });
    return apiErrors.internal("Internal server error");
  }
}

