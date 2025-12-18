import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors, success, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import { isDevelopment } from "@/lib/env";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bumpSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      const body = await validateBody(bumpSchema, await req.json());
      const orderId = body.orderId;
      const venueId = context.venueId;

      if (!venueId) return apiErrors.badRequest("venue_id is required");

      const admin = createAdminClient();
      const { data, error } = await admin.rpc("orders_set_kitchen_bumped", {
        p_order_id: orderId,
        p_venue_id: venueId,
      });

      if (error) {
        logger.error("[ORDERS BUMP] RPC error", {
          error: error.message,
          orderId,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.badRequest(isDevelopment() ? error.message : "Failed to bump order");
      }

      return success({ order: Array.isArray(data) ? data[0] : data });
    } catch (err) {
      if (isZodError(err)) {
        return handleZodError(err);
      }
      logger.error("[ORDERS BUMP] Unexpected error", {
        error: err instanceof Error ? err.message : String(err),
        venueId: context.venueId,
        userId: context.user?.id,
      });
      return apiErrors.internal("Request processing failed", isDevelopment() ? err : undefined);
    }
  },
  {
    requireRole: ["owner", "manager", "staff", "kitchen"],
    extractVenueId: async (_req, params) => {
      // Prefer route param orderId
      const orderId = (params as { orderId?: string } | undefined)?.orderId;
      if (!orderId) return null;
      const admin = createAdminClient();
      const { data: order } = await admin
        .from("orders")
        .select("venue_id")
        .eq("id", orderId)
        .single();
      return (order?.venue_id as string | undefined) ?? null;
    },
  }
);

