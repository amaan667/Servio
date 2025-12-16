export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
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
      const { data: currentOrder } = await admin
        .from("orders")
        .select("kitchen_status, completion_status")
        .eq("id", orderId)
        .eq("venue_id", venueId)
        .single();

      if (!currentOrder) {
        return apiErrors.notFound("Order not found");
      }

      // If kitchen_status is not BUMPED, check if all tickets are bumped
      if (currentOrder.kitchen_status?.toUpperCase() !== "BUMPED") {
        // Check if all KDS tickets for this order are bumped
        const { data: tickets } = await admin
          .from("kds_tickets")
          .select("id, status")
          .eq("order_id", orderId)
          .eq("venue_id", venueId);

        // If no tickets exist, consider it as all bumped (order might not have KDS tickets)
        const allBumped = !tickets || tickets.length === 0 || tickets.every((t) => t.status === "bumped");

        if (allBumped) {
          // Set kitchen_status to BUMPED first
          const { error: bumpError } = await admin.rpc("orders_set_kitchen_bumped", {
            p_order_id: orderId,
            p_venue_id: venueId,
          });

          if (bumpError) {
            logger.error("[ORDERS SERVE] Failed to set kitchen_status to BUMPED", {
              error: bumpError.message,
              orderId,
              venueId,
            });
            // Continue anyway - the RPC will handle the validation
          }
        } else {
          // Not all tickets are bumped yet
          return apiErrors.badRequest(
            "Cannot mark order as served: not all items have been bumped in the kitchen"
          );
        }
      }

      // Canonical transition: SERVE (requires kitchen_status=BUMPED, enforced in RPC)
      const { data, error } = await admin.rpc("orders_set_served", {
        p_order_id: orderId,
        p_venue_id: venueId,
      });

      if (error) {
        logger.error("[ORDERS SERVE] RPC error", {
          error: error.message,
          orderId,
          venueId,
          currentKitchenStatus: currentOrder.kitchen_status,
        });
        const msg = isDevelopment() ? error.message : "Failed to mark order as served";
        return apiErrors.badRequest(msg);
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
        success: true,
        order: Array.isArray(data) ? data[0] : data,
      });
    } catch (_error) {
      logger.error("[ORDERS SERVE] Unexpected error", {
        error: _error instanceof Error ? _error.message : String(_error),
        venueId: context.venueId,
        userId: context.user?.id,
      });
      return apiErrors.internal("Internal server error", isDevelopment() ? _error : undefined);
    }
  },
  {
    extractVenueId: async (req) => {
      try {
        const body = await req.clone().json();
        const orderId = body?.orderId;
        if (!orderId) return null;
        const admin = createAdminClient();
        const { data: order } = await admin.from("orders").select("venue_id").eq("id", orderId).single();
        return (order?.venue_id as string | undefined) ?? null;
      } catch {
        return null;
      }
    },
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
  }
);
