export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const { orderId } = (await req.json()) as { orderId?: string };
      if (!orderId) return apiErrors.badRequest("Order ID is required");

      const venueId = context.venueId;
      if (!venueId) return apiErrors.badRequest("venue_id is required");

      const admin = createAdminClient();

      // Check if order's kitchen_status is BUMPED before serving
      // If not, check if all KDS tickets are bumped and update kitchen_status first
      const { data: currentOrder, error: fetchError } = await admin
        .from("orders")
        .select("kitchen_status, completion_status, order_status")
        .eq("id", orderId)
        .eq("venue_id", venueId)
        .single();

      if (fetchError || !currentOrder) {
        
        return apiErrors.notFound("Order not found");
      }

      

      // If kitchen_status is not BUMPED (including NULL), check if all tickets are bumped
      const kitchenStatusUpper = (currentOrder.kitchen_status || "").toUpperCase();
      if (kitchenStatusUpper !== "BUMPED") {
        // Check if all KDS tickets for this order are bumped
        const { data: tickets, error: ticketsError } = await admin
          .from("kds_tickets")
          .select("id, status")
          .eq("order_id", orderId)
          .eq("venue_id", venueId);

        if (ticketsError) {
          
        }

        // If no tickets exist, consider it as all bumped (order might not have KDS tickets)
        const allBumped =
          !tickets || tickets.length === 0 || tickets.every((t) => t.status === "bumped");

         => t.status === "bumped").length || 0,
          allBumped,

        if (allBumped) {
          // Set kitchen_status to BUMPED first
          const { data: bumpResult, error: bumpError } = await admin.rpc(
            "orders_set_kitchen_bumped",
            {

            }
          );

          if (bumpError) {
            
            return apiErrors.badRequest(
              `Failed to set kitchen status: ${bumpError.message || "Unknown error"}`
            );
          }

          
        } else {
          // Not all tickets are bumped yet
          const notBumpedCount = tickets?.filter((t) => t.status !== "bumped").length || 0;
          
          return apiErrors.badRequest(
            `Cannot mark order as served: ${notBumpedCount} item(s) still need to be bumped in the kitchen`
          );
        }
      }

      // Verify order state before calling serve RPC
      const { data: verifyOrder, error: verifyError } = await admin
        .from("orders")
        .select("kitchen_status, completion_status, service_status, order_status")
        .eq("id", orderId)
        .eq("venue_id", venueId)
        .single();

      if (verifyError || !verifyOrder) {
        
        return apiErrors.notFound("Order not found");
      }

      // Check completion_status
      if (verifyOrder.completion_status?.toUpperCase() !== "OPEN") {
        
        return apiErrors.badRequest(
          `Order cannot be served: order is ${verifyOrder.completion_status || "not open"}`
        );
      }

      // Check if already served
      if (verifyOrder.service_status?.toUpperCase() === "SERVED") {
        
        // Return success since it's already in the desired state
        return NextResponse.json({

      }

      // Verify kitchen_status is BUMPED
      if (verifyOrder.kitchen_status?.toUpperCase() !== "BUMPED") {
        
        return apiErrors.badRequest(
          "Order kitchen status is not BUMPED. Please ensure all items are bumped in the kitchen first."
        );
      }

      // Canonical transition: SERVE (requires kitchen_status=BUMPED, enforced in RPC)
      const { data, error } = await admin.rpc("orders_set_served", {

      if (error) {
        
        // Return the actual error message from the RPC
        const errorMsg = error.message || "Failed to mark order as served";
        return apiErrors.badRequest(errorMsg);
      }

      // Verify the update actually happened
      if (!data || (Array.isArray(data) && data.length === 0)) {
        
        return apiErrors.badRequest("Failed to update order status - no data returned");
      }

      // Best-effort: update table_sessions status to SERVED for table UI
      try {
        await admin
          .from("table_sessions")
          .update({ status: "SERVED", updated_at: new Date().toISOString() })
          .eq("order_id", orderId)
          .eq("venue_id", venueId);
      } catch {
        // Best-effort only
      }

      return NextResponse.json({

    } catch (_error) {

      return apiErrors.internal("Internal server error", isDevelopment() ? _error : undefined);
    }
  },
  {

        const { data: order } = await admin
          .from("orders")
          .select("venue_id")
          .eq("id", orderId)
          .single();
        return (order?.venue_id as string | undefined) ?? null;
      } catch {
        return null;
      }
    },
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
  }
);
