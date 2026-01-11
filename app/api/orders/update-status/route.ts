import { apiErrors, success } from "@/lib/api/standard-response";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { cleanupTableOnOrderCompletion } from "@/lib/table-cleanup";

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

    // CRITICAL: Verify payment status before allowing COMPLETED
    if (status === "COMPLETED") {
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("payment_status, order_status")
        .eq("id", orderId)
        .single();

      if (!currentOrder) {
        return apiErrors.notFound("Order not found");
      }

      const paidStatuses = ["PAID", "TILL"];
      const currentPayment = (currentOrder.payment_status || "").toUpperCase();
      if (!paidStatuses.includes(currentPayment)) {
        return apiErrors.badRequest(
          `Cannot complete order: payment status is ${currentOrder.payment_status}. Order must be PAID or TILL before completion.`,
          { payment_status: currentOrder.payment_status }
        );
      }

      // Also verify order is in a completable state
      const completableStatuses = ["SERVED", "READY", "SERVING"];
      if (!completableStatuses.includes(currentOrder.order_status)) {
        return apiErrors.badRequest(
          `Cannot complete order: current status is ${currentOrder.order_status}. Order must be SERVED, READY, or SERVING before completion.`,
          { current_status: currentOrder.order_status }
        );
      }
    }

    // Update order status, and also set completion_status if completing
    const updateData: Record<string, unknown> = { order_status: status };
    if (status === "COMPLETED") {
      updateData.completion_status = "COMPLETED";
      updateData.completed_at = new Date().toISOString();
    } else if (status === "CANCELLED") {
      updateData.completion_status = "COMPLETED"; // Cancelled orders are also "completed" in lifecycle
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select();

    if (error) {

      return apiErrors.internal(error.message);
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
        if (
          status === "COMPLETED" &&
          ["PAID", "TILL"].includes((order.payment_status || "").toUpperCase())
        ) {
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
