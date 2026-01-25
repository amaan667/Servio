import { createApiHandler } from "@/lib/api/production-handler";
import { kdsService } from "@/lib/services/KDSService";
import { z } from "zod";

export const runtime = "nodejs";

const updateTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum(["new", "in_progress", "preparing", "ready", "bumped", "served", "cancelled"]),
});

/**
 * GET: Fetch KDS tickets with auto-backfill
 */
export const GET = createApiHandler(
  async (req, context) => {
    const { venueId } = context;
    const stationId = req.nextUrl.searchParams.get("station_id") || undefined;
    const status = req.nextUrl.searchParams.get("status") || undefined;

    // 1. Proactive backfill for missing tickets
    await kdsService.autoBackfill(venueId);

    // 2. Fetch tickets
    const tickets = await kdsService.getTickets(venueId, {
      station_id: stationId,
      status: status,
    });

    return { tickets };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);

/**
 * PATCH: Update KDS ticket status
 */
export const PATCH = createApiHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    const ticket = await kdsService.updateTicketStatus(body.ticket_id, venueId, body.status);
    return { ticket };
  },
  {
    requireVenueAccess: true,
    schema: updateTicketSchema,
    enforceIdempotency: true,
  }
);
