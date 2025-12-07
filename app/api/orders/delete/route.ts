import { createAdminClient } from "@/lib/supabase";
import { success, apiErrors } from '@/lib/api/standard-response';
import { logger } from '@/lib/logger';

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
  const { orderId, venue_id } = await req.json().catch(() => ({ /* Empty */ }));
    if (!orderId || !venue_id) {
      return apiErrors.badRequest("orderId and venue_id required");
    }

  // Use admin client - no authentication required for Live Orders feature
  const admin = createAdminClient();
  const { error } = await admin.from("orders").delete().eq("id", orderId).eq("venue_id", venue_id);
    
    if (error) {
      logger.error("[ORDERS DELETE] Database error", { error: error.message, orderId, venue_id });
      return apiErrors.database(error.message);
    }
    
    return success({});
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    logger.error("[ORDERS DELETE] Unexpected error", { error: errorMessage });
    return apiErrors.internal(errorMessage);
  }
}
