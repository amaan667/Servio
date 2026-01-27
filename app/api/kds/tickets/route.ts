import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { kdsService } from "@/lib/services/KDSService";
import { z } from "zod";

export const runtime = "nodejs";

const updateTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum(["new", "in_progress", "preparing", "ready", "bumped", "served", "cancelled"]),
});

/**
 * GET: Fetch KDS tickets with auto-backfill (middleware auth; KDS rate limit)
 */
export const GET = createUnifiedHandler(
  async (req, context) => {
    const { venueId } = context;
    const stationId = req.nextUrl.searchParams.get("station_id") || undefined;
    const status = req.nextUrl.searchParams.get("status") || undefined;

    await kdsService.autoBackfill(venueId);
    const tickets = await kdsService.getTickets(venueId, {
      station_id: stationId,
      status: status,
    });
    return { tickets };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
    rateLimit: RATE_LIMITS.KDS,
  }
);

/**
 * PATCH: Update KDS ticket status (middleware auth; KDS rate limit)
 */
export const PATCH = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    const ticket = await kdsService.updateTicketStatus(body.ticket_id, venueId, body.status);
    return { ticket };
  },
  {
    requireVenueAccess: true,
    schema: updateTicketSchema,
    enforceIdempotency: true,
    rateLimit: RATE_LIMITS.KDS,
  }
);
