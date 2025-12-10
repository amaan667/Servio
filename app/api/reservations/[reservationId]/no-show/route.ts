import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors } from "@/lib/api/standard-response";

type ReservationRouteContext = {
  params?: {
    reservationId?: string;
  };
};

export async function POST(_request: NextRequest, context?: ReservationRouteContext) {
  try {
    const reservationId = context?.params?.reservationId;

    if (!reservationId) {
      return apiErrors.badRequest("reservationId is required");
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc("api_no_show_reservation", {
      p_reservation_id: reservationId,
    });

    if (error) {
      logger.error("Error marking reservation as no-show", {
        error: error.message,
      });
      return apiErrors.internal(error.message || 'Internal server error');
    }

    return success({});
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("Error in no-show reservation API", {
      error: errorMessage,
    });
    return apiErrors.internal('Internal server error');
  }
}
