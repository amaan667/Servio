import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const createReservationSchema = z.object({
  tableId: z.string().uuid().optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  partySize: z.number().int().positive().optional().default(2),
  name: z.string().min(1),
  phone: z.string().optional().nullable(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body, venueId } = context;
    const { tableId, startAt, endAt, partySize, name, phone } = body;

    // Validation already done by unified handler schema
    if (new Date(startAt) >= new Date(endAt)) {
      return apiErrors.badRequest("endAt must be after startAt");
    }

    if (!venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    const adminSupabase = createAdminClient();

    // Create reservation
    const { data: reservation, error: reservationError } = await adminSupabase
      .from("reservations")
      .insert({
        venue_id: venueId,
        table_id: tableId || null,
        start_at: startAt,
        end_at: endAt,
        party_size: partySize || 2,
        customer_name: name,
        customer_phone: phone || null,
        status: "BOOKED",
      })
      .select()
      .single();

    if (reservationError) {
      return apiErrors.database(reservationError.message || "Failed to create reservation");
    }

    return success({
      ok: true,
      reservation,
    });
  },
  {
    schema: createReservationSchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
  }
);
