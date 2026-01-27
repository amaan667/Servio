import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getStripeClient } from "@/lib/stripe-client";
import { getAuthUserForAPI } from "@/lib/auth/server";

import { withStripeRetry } from "@/lib/stripe-retry";
import type Stripe from "stripe";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export async function POST(req: NextRequest, context: { params: Promise<{ orderId: string }> }) {
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

    // If the order was not paid via Stripe, record a manual refund in our system only
    const isStripeOrder = !!(order.stripe_payment_intent_id || order.stripe_session_id);

    if (!isStripeOrder) {
      const manualRefundAmount = refundAmount ?? orderAmount;

      if (manualRefundAmount > orderAmount) {
        return apiErrors.badRequest("Refund amount cannot exceed order total");
      }

      const isPartialManualRefund = manualRefundAmount < orderAmount;
      const manualPaymentStatus = isPartialManualRefund ? "PARTIALLY_REFUNDED" : "REFUNDED";

      const { error: manualUpdateError } = await supabase
        .from("orders")
        .update({
          payment_status: manualPaymentStatus,
          refund_amount: manualRefundAmount / 100,
          refund_id: null,
          refund_reason: reason || null,
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (manualUpdateError) {
        return apiErrors.internal("Failed to record manual refund", manualUpdateError.message);
      }

      return success({
        refund: {
          id: null,
          amount: manualRefundAmount / 100,
          status: "manual_recorded",
          payment_status: manualPaymentStatus,
        },
        order_id: orderId,
        processed_via: "manual",
      });
    }

    // Stripe-backed refund: call Stripe and then update our order
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

      const refund = await withStripeRetry(() => stripe.refunds.create(refundParams), {
        maxRetries: 3,
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
        processed_via: "stripe",
      });
    } catch (stripeError) {
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

    return apiErrors.internal("Internal server error");
  }
}
