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

      // Canonical transition: SERVE (requires kitchen_status=BUMPED, enforced in RPC)
      const { data, error } = await admin.rpc("orders_set_served", {
        p_order_id: orderId,
        p_venue_id: venueId,
      });

      if (error) {
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
