import { apiErrors, success } from "@/lib/api/standard-response";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";
import {
  deriveQrTypeFromOrder,
  normalizePaymentStatus,
  validateOrderStatusTransition,
} from "@/lib/orders/qr-payment-validation";

import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return apiErrors.unauthorized("Unauthorized");
    }

    const { orderId, status } = await req.json();

    if (!orderId || !status) {
      return apiErrors.badRequest("orderId and status required");
    }

    // Create authenticated supabase client (respects RLS)
    const supabase = await createServerSupabase();

    // First verify the order belongs to a venue the user has access to
    const { data: orderCheck } = await supabase
      .from("orders")
      .select("venue_id")
      .eq("id", orderId)
      .single();

    if (!orderCheck) {
      return apiErrors.notFound("Order not found");
    }

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", orderCheck.venue_id)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", orderCheck.venue_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return apiErrors.forbidden("Forbidden");
    }

    const { data: currentOrder } = await supabase
      .from("orders")
      .select("payment_status, order_status, qr_type, fulfillment_type, source, requires_collection")
      .eq("id", orderId)
      .single();

    if (!currentOrder) {
      return apiErrors.notFound("Order not found");
    }

    const qrType = deriveQrTypeFromOrder(currentOrder);
    const normalizedPaymentStatus = normalizePaymentStatus(currentOrder.payment_status) || "UNPAID";
    const transitionValidation = validateOrderStatusTransition({
      qrType,
      paymentStatus: normalizedPaymentStatus,
      currentStatus: currentOrder.order_status || "",
      nextStatus: status,
    });

    if (!transitionValidation.ok) {
      return apiErrors.badRequest(
        transitionValidation.error || "Order status transition not allowed"
      );
    }

    // Update order status, and also set completion_status if completing
    const updateData: Record<string, unknown> = {
      order_status: status,
      fulfillment_status:
        status === "CANCELLED"
          ? "CANCELLED"
          : status === "COMPLETED"
            ? "COMPLETED"
            : status === "SERVED"
              ? "SERVED"
              : status === "READY"
                ? "READY"
                : "PREPARING",
    };
    if (status === "COMPLETED") {
      updateData.completion_status = "COMPLETED";
      updateData.completed_at = new Date().toISOString();
    } else if (status === "CANCELLED") {
      updateData.completion_status = "COMPLETED"; // Cancelled orders are also "completed" in lifecycle
    }

    // Get current order status before update (to check if transitioning to READY)
    const { data: currentOrderData } = await supabase
      .from("orders")
      .select("order_status, source, customer_phone, customer_email")
      .eq("id", orderId)
      .single();

    const previousStatus = currentOrderData?.order_status;

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select();

    if (error) {

      return apiErrors.internal(error.message);
    }

    // Send "Order Ready" notification when order status changes to READY
    // This is particularly useful for counter-service/collection orders
    if (status === "READY" && previousStatus !== "READY") {
      const order = data?.[0];
      if (order) {
        // Check if venue has counter pickup service and customer has contact info
        const isCounterOrder = order.source === "counter" || order.order_type === "counter";
        const hasContactInfo = order.customer_phone || order.customer_email;

        if (hasContactInfo) {
          // Get venue settings to check notification preferences
          const { data: venueSettings } = await supabase
            .from("venues")
            .select("service_type, notify_customer_on_ready")
            .eq("venue_id", order.venue_id)
            .single();

          // Only send notifications if enabled (default to true for counter service venues)
          const shouldNotify =
            venueSettings?.notify_customer_on_ready ??
            (venueSettings?.service_type === "counter_pickup" ||
              venueSettings?.service_type === "both" ||
              isCounterOrder);

          if (shouldNotify) {
            try {
              // Build notification channels based on available contact info
              const notificationChannels: string[] = [];
              if (order.customer_phone) notificationChannels.push("sms");
              if (order.customer_email) notificationChannels.push("email");

              // Fire and forget - don't wait for notification to complete
              const baseUrl =
                env("NEXT_PUBLIC_SITE_URL") || "https://servio-production.up.railway.app";

              fetch(`${baseUrl}/api/orders/notify-ready`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  // Pass auth headers for internal call
                  Cookie: req.headers.get("cookie") || "",
                },
                body: JSON.stringify({
                  orderId,
                  venueId: order.venue_id,
                  notificationChannels,
                }),
              }).catch(() => {
                // Notification failed silently - don't block status update
              });
            } catch {
              // Don't fail the status update if notification setup fails
            }
          }
        }
      }
    }

    // Deduct inventory stock when order is completed
    if (status === "COMPLETED") {
      const order = data?.[0];
      if (order) {
        try {
          // Call inventory deduction
          await supabase.rpc("deduct_stock_for_order", {
            p_order_id: orderId,
            p_venue_id: order.venue_id,
          });
        } catch (inventoryError) {

          // Don't fail the order completion if inventory deduction fails
        }
      }
    }

    // Handle table state transitions when order is completed or cancelled
    if (status === "COMPLETED" || status === "CANCELLED") {
      const order = data?.[0];
      if (order && (order.table_id || order.table_number)) {
        // Use centralized table cleanup function
        const cleanupResult = await cleanupTableOnOrderCompletion({
          venueId: order.venue_id,
          tableId: order.table_id,
          tableNumber: order.table_number,
          orderId: orderId,
        });

        if (!cleanupResult.success) { /* Condition handled */ } else {
          // Block handled
        }

        // If order is completed and paid, check if reservations should be auto-completed
        if (status === "COMPLETED" && (order.payment_status || "").toUpperCase() === "PAID") {
          try {
            const baseUrl =
              env("NEXT_PUBLIC_SITE_URL") || "https://servio-production.up.railway.app";
            const completionResponse = await fetch(`${baseUrl}/api/reservations/check-completion`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                venueId: order.venue_id,
                tableId: order.table_id,
              }),
            });

            if (completionResponse.ok) {
              await completionResponse.json();
            }
          } catch (completionError) {

            // Don't fail the main request if completion check fails
          }
        }
      }
    }

    return success({ order: data?.[0] });
  } catch (_error) {

    return apiErrors.internal("Internal server error");
  }
}
