import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { reservationService } from "@/lib/services/ReservationService";
import { z } from "zod";

export const runtime = "nodejs";

const createReservationSchema = z.object({
  customer_name: z.string().min(1),
  customer_phone: z.string().optional().nullable(),
  customer_email: z.string().email().optional().nullable(),
  party_size: z.number().int().positive(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  table_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * GET: Fetch reservations for a venue
 */
export const GET = createUnifiedHandler(
  async (req, context) => {
    const status = req.nextUrl.searchParams.get("status") || undefined;
    const date = req.nextUrl.searchParams.get("date") || undefined;

    const reservations = await reservationService.getReservations(context.venueId, {
      status,
      date,
    });

    return { reservations };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);

/**
 * POST: Create a new reservation
 */
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, venueId } = context;
    const reservation = await reservationService.createReservation(venueId, body);
    return { reservation };
  },
  {
    requireVenueAccess: true,
    schema: createReservationSchema,
    enforceIdempotency: true,
  }
);
