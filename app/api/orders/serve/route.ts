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
      const { data: currentOrder, error: fetchError } = await admin
        .from("orders")
        .select("kitchen_status, completion_status, order_status")
        .eq("id", orderId)
        .eq("venue_id", venueId)
        .single();

      if (fetchError || !currentOrder) {
        logger.error("[ORDERS SERVE] Failed to fetch order", {
          error: fetchError?.message,
          orderId,
          venueId,
        });
        return apiErrors.notFound("Order not found");
      }

      logger.debug("[ORDERS SERVE] Current order state", {
        orderId,
        venueId,
        kitchen_status: currentOrder.kitchen_status,
        completion_status: currentOrder.completion_status,
        order_status: currentOrder.order_status,
      });

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
          logger.error("[ORDERS SERVE] Failed to fetch tickets", {
            error: ticketsError.message,
            orderId,
            venueId,
          });
        }

        // If no tickets exist, consider it as all bumped (order might not have KDS tickets)
        const allBumped = !tickets || tickets.length === 0 || tickets.every((t) => t.status === "bumped");

        logger.debug("[ORDERS SERVE] Ticket check", {
          orderId,
          ticketCount: tickets?.length || 0,
          bumpedCount: tickets?.filter((t) => t.status === "bumped").length || 0,
          allBumped,
        });

        if (allBumped) {
          // Set kitchen_status to BUMPED first
          const { data: bumpResult, error: bumpError } = await admin.rpc("orders_set_kitchen_bumped", {
            p_order_id: orderId,
            p_venue_id: venueId,
          });

          if (bumpError) {
            logger.error("[ORDERS SERVE] Failed to set kitchen_status to BUMPED", {
              error: bumpError.message,
              orderId,
              venueId,
              bumpResult,
            });
            return apiErrors.badRequest(
              `Failed to set kitchen status: ${bumpError.message || "Unknown error"}`
            );
          }

          logger.debug("[ORDERS SERVE] Successfully set kitchen_status to BUMPED", {
            orderId,
            venueId,
            bumpResult,
          });
        } else {
          // Not all tickets are bumped yet
          const notBumpedCount = tickets?.filter((t) => t.status !== "bumped").length || 0;
          logger.debug("[ORDERS SERVE] Not all tickets bumped", {
            orderId,
            totalTickets: tickets?.length || 0,
            notBumpedCount,
          });
          return apiErrors.badRequest(
            `Cannot mark order as served: ${notBumpedCount} item(s) still need to be bumped in the kitchen`
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
