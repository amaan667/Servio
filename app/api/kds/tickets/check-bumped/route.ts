import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const checkBumpedSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  venue_id: z.string().uuid("Invalid venue ID").optional(),
});

// POST - Check if all KDS tickets for an order are bumped
// This endpoint can be called without auth (for OrderCard component)
export async function POST(req: NextRequest) {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(
        Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
      );
    }

    // STEP 2: Validate input
    const body = await validateBody(checkBumpedSchema, await req.json());
    const orderId = body.order_id;
    const venueIdFromBody = body.venue_id;

    // STEP 3: Get venueId from body or extract from order
    const supabase = createAdminClient();
    let venueId = venueIdFromBody;

    // If venueId not in body, extract from order
    if (!venueId && orderId) {
      const { data: order } = await supabase
        .from("orders")
        .select("venue_id")
        .eq("id", orderId)
        .single();
      if (order?.venue_id) {
        venueId = order.venue_id;
      }
    }

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required (provide in body or it will be extracted from order)");
    }

      // STEP 4: Business logic - Check if all tickets are bumped

      // Get all tickets for this order
      const { data: tickets, error: fetchError } = await supabase
        .from("kds_tickets")
        .select("id, status")
        .eq("order_id", orderId)
        .eq("venue_id", venueId);

      if (fetchError) {
      logger.error("[KDS CHECK BUMPED] Error fetching tickets:", {
        error: fetchError.message,
        orderId,
        venueId,
      });
        return apiErrors.database(
          "Failed to check ticket status",
          isDevelopment() ? fetchError.message : undefined
        );
      }

      // If no tickets exist, consider it as "all bumped" (order might not have KDS tickets)
      if (!tickets || tickets.length === 0) {
        logger.debug("[KDS CHECK BUMPED] No tickets found for order", {
          orderId,
          venueId,
        });
        return success({ all_bumped: true, ticket_count: 0 });
      }

      // Check if all tickets are bumped
      const allBumped = tickets.every((t) => t.status === "bumped");
      const bumpedCount = tickets.filter((t) => t.status === "bumped").length;

      logger.debug("[KDS CHECK BUMPED] Ticket status checked", {
        orderId,
        venueId,
        totalTickets: tickets.length,
        bumpedCount,
        allBumped,
      });

      // STEP 5: Return success response
      return success({
        all_bumped: allBumped,
        ticket_count: tickets.length,
        bumped_count: bumpedCount,
      });
    } catch (error) {
      logger.error("[KDS CHECK BUMPED] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
}
