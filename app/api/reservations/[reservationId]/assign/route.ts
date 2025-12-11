import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody, validateParams } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const assignReservationSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

const reservationIdParamSchema = z.object({
  reservationId: z.string().uuid("Invalid reservation ID"),
});

// POST /api/reservations/[reservationId]/assign - Assign reservation to table
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ reservationId: string }> }
) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext, routeParams) => {
      try {
        // STEP 1: Rate limiting (ALWAYS FIRST)
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
        }

        // STEP 2: Validate params and body
        const params = await routeParams!.params!;
        const validatedParams = validateParams(reservationIdParamSchema, params);
        const body = await validateBody(assignReservationSchema, await req.json());

        // STEP 3: Business logic
        const supabase = createAdminClient();

        // Get reservation to validate it exists
        const { data: reservation, error: reservationError } = await supabase
          .from("reservations")
          .select("venue_id")
          .eq("id", validatedParams.reservationId)
          .eq("venue_id", authContext.venueId)
          .single();

        if (reservationError || !reservation) {
          logger.warn("[RESERVATIONS ASSIGN] Reservation not found", {
            reservationId: validatedParams.reservationId,
            venueId: authContext.venueId,
            userId: authContext.user.id,
          });
          return apiErrors.notFound("Reservation not found");
        }

        // Call the database function to assign reservation
        const { error } = await supabase.rpc("api_assign_reservation", {
          p_reservation_id: validatedParams.reservationId,
          p_table_id: body.tableId,
        });

        if (error) {
          logger.error("[RESERVATIONS ASSIGN] Error assigning reservation:", {
            error: error.message,
            reservationId: validatedParams.reservationId,
            tableId: body.tableId,
            userId: authContext.user.id,
          });
          return apiErrors.badRequest(error.message || "Failed to assign reservation");
        }

        logger.info("[RESERVATIONS ASSIGN] Reservation assigned successfully", {
          reservationId: validatedParams.reservationId,
          tableId: body.tableId,
          userId: authContext.user.id,
        });

        // STEP 4: Return success response
        return success({
          message: "Reservation assigned successfully",
        });
      } catch (error) {
        logger.error("[RESERVATIONS ASSIGN] Unexpected error:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: authContext.user.id,
        });

        if (isZodError(error)) {
          return handleZodError(error);
        }

        return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
      }
    },
    {
      extractVenueId: async (req, routeParams) => {
        // Get venueId from reservation record
        if (routeParams?.params) {
          const params = await routeParams.params;
          const reservationId = params?.reservationId;
          if (reservationId) {
            const adminSupabase = createAdminClient();
            const { data: reservation } = await adminSupabase
              .from("reservations")
              .select("venue_id")
              .eq("id", reservationId)
              .single();
            if (reservation?.venue_id) {
              return reservation.venue_id;
            }
          }
        }
        // Fallback to query/body
        const url = new URL(req.url);
        return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
      },
    }
  );

  return handler(req, context);
}
