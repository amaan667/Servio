import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import { getRequestMetadata, getIdempotencyKey } from "@/lib/api/request-helpers";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";

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
  const requestMetadata = getRequestMetadata(req);
  const requestId = requestMetadata.correlationId;
  
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000), requestId);
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

      return apiErrors.database(
        "Failed to fetch reservations",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    // STEP 5: Return success response
    return success(
      { reservations: reservations || [] },
      { timestamp: new Date().toISOString(), requestId },
      requestId
    );
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal(
      "Request processing failed",
      isDevelopment() ? error : undefined,
      requestId
    );
  }
});

/**
 * Create a new reservation
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only create reservations for venues they have access to.
 */
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  const requestMetadata = getRequestMetadata(req);
  const requestId = requestMetadata.correlationId;
  
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000), requestId);
    }

    // STEP 2: Validate input
    const body = await validateBody(createReservationSchema, await req.json());

    // Optional idempotency check (non-breaking - only if header is provided)
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const existing = await checkIdempotency(idempotencyKey);
      if (existing.exists) {
        return success(
          existing.response.response_data as { reservation: unknown },
          { timestamp: new Date().toISOString(), requestId },
          requestId
        );
      }
    }
    const venueId = context.venueId || body.venue_id;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // Verify venue matches context (double-check for security)
    if (body.venue_id && body.venue_id !== context.venueId) {

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

      return apiErrors.database(
        "Failed to create reservation",
        isDevelopment() ? createError?.message : undefined
      );
    }

    // STEP 4: Return success response
    const response = { reservation };

    // Store idempotency key if provided (non-breaking - only if header was sent)
    if (idempotencyKey) {
      const requestHash = JSON.stringify(body);
      await storeIdempotency(
        idempotencyKey,
        requestHash,
        response,
        200,
        3600 // 1 hour TTL
      ).catch(() => {
        // Don't fail request if idempotency storage fails
      });
    }

    return success(response, { timestamp: new Date().toISOString(), requestId }, requestId);
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal(
      "Request processing failed",
      isDevelopment() ? error : undefined,
      requestId
    );
  }
});
