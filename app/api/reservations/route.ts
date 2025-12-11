import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const createReservationSchema = z.object({
  venue_id: z.string().uuid("Invalid venue ID"),
  customer_name: z.string().min(1, "Customer name is required"),
  customer_phone: z.string().optional(),
  customer_email: z.string().email("Invalid email").optional(),
  party_size: z.number().int().positive("Party size must be positive"),
  start_at: z.string().datetime("Invalid start time"),
  end_at: z.string().datetime("Invalid end time"),
  table_id: z.string().uuid("Invalid table ID").optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Get reservations for a venue
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only access reservations for venues they have access to.
 */
export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Get venueId from context (already verified by withUnifiedAuth)
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 3: Parse query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const date = searchParams.get("date");

    // STEP 4: Business logic - Fetch reservations
    // Use authenticated client that respects RLS (not admin client)
    // RLS policies ensure users can only access reservations for venues they have access to
    const supabase = await createClient();

    // RLS ensures user can only access reservations for venues they have access to
    let query = supabase
      .from("reservations")
      .select("*")
      .eq("venue_id", venueId) // Explicit venue check (RLS also enforces this)
      .order("start_at", { ascending: true });

    if (status) {
      query = query.eq("status", status);
    }

    if (date) {
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      query = query.gte("start_at", dateStart.toISOString()).lte("start_at", dateEnd.toISOString());
    }

    const { data: reservations, error: fetchError } = await query;

    if (fetchError) {
      logger.error("[RESERVATIONS GET] Error fetching reservations:", {
        error: fetchError.message,
        venueId,
        userId: context.user.id,
      });
      return apiErrors.database(
        "Failed to fetch reservations",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    logger.info("[RESERVATIONS GET] Reservations fetched successfully", {
      venueId,
      reservationCount: reservations?.length || 0,
      userId: context.user.id,
    });

    // STEP 5: Return success response
    return success({ reservations: reservations || [] });
  } catch (error) {
    logger.error("[RESERVATIONS GET] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      venueId: context.venueId,
      userId: context.user.id,
    });

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});

/**
 * Create a new reservation
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only create reservations for venues they have access to.
 */
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Validate input
    const body = await validateBody(createReservationSchema, await req.json());
    const venueId = context.venueId || body.venue_id;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // Verify venue matches context (double-check for security)
    if (body.venue_id && body.venue_id !== context.venueId) {
      logger.error("[RESERVATIONS POST] Venue mismatch:", {
        bodyVenueId: body.venue_id,
        contextVenueId: context.venueId,
        userId: context.user.id,
      });
      return apiErrors.forbidden("Reservation must be created for your venue");
    }

    // STEP 3: Business logic - Create reservation
    // Use authenticated client that respects RLS (not admin client)
    // RLS policies ensure users can only create reservations for venues they have access to
    const supabase = await createClient();

    // RLS ensures user can only create reservations for venues they have access to
    const { data: reservation, error: createError } = await supabase
      .from("reservations")
      .insert({
        venue_id: venueId,
        customer_name: body.customer_name,
        customer_phone: body.customer_phone || null,
        customer_email: body.customer_email || null,
        party_size: body.party_size,
        start_at: body.start_at,
        end_at: body.end_at,
        table_id: body.table_id || null,
        notes: body.notes || null,
        status: "BOOKED",
      })
      .select()
      .single();

    if (createError || !reservation) {
      logger.error("[RESERVATIONS POST] Error creating reservation:", {
        error: createError?.message,
        venueId,
        userId: context.user.id,
      });
      return apiErrors.database(
        "Failed to create reservation",
        isDevelopment() ? createError?.message : undefined
      );
    }

    logger.info("[RESERVATIONS POST] Reservation created successfully", {
      venueId,
      reservationId: reservation.id,
      customerName: body.customer_name,
      userId: context.user.id,
    });

    // STEP 4: Return success response
    return success({ reservation });
  } catch (error) {
    logger.error("[RESERVATIONS POST] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      venueId: context.venueId,
      userId: context.user.id,
    });

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});
