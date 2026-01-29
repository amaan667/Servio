import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const bulkUpdateTicketsSchema = z.object({
  ticket_ids: z.array(z.string().uuid()).min(1, "At least one ticket ID is required"),
  status: z.enum(["ready", "preparing", "bumped", "served", "cancelled"]),
  order_id: z.string().uuid().optional(),
});

// PATCH - Bulk update multiple tickets (e.g., bump all ready tickets for an order)
export const PATCH = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Get venueId from context (already verified)
    const venueId = context.venueId;
    const { body } = context;
    const { ticket_ids, status, order_id: orderId } = body;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // Business logic - Update tickets
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: tickets, error: updateError } = await supabase
      .from("kds_tickets")
      .update({
        status,
        updated_at: now,
      })
      .in("id", ticket_ids)
      .eq("venue_id", venueId)
      .select();

    if (updateError) {
      return apiErrors.database("Failed to update tickets");
    }

    // If bumping tickets, check if ALL tickets for this order are now bumped
    if (status === "bumped" && orderId) {
      // Check if all tickets for this order are bumped
      const { data: allOrderTickets } = await supabase
        .from("kds_tickets")
        .select("id, status")
        .eq("order_id", orderId)
        .eq("venue_id", venueId);

      const allBumped = allOrderTickets?.every((t) => t.status === "bumped") || false;

      // Only update order status if ALL tickets are bumped
      if (allBumped) {
        await supabase.rpc("orders_set_kitchen_bumped", {
          p_order_id: orderId,
          p_venue_id: venueId,
        });
      }
    }

    return success({
      updated: tickets?.length || 0,
      tickets: tickets || [],
    });
  },
  {
    schema: bulkUpdateTicketsSchema,
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.KDS,
  }
);
