import { success, apiErrors } from "@/lib/api/standard-response";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/monitoring/structured-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check for active unpaid orders for a table
 * Uses service role to bypass RLS - customers don't need auth to check their orders
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    const tableNumber = searchParams.get("tableNumber");

    if (!venueId || !tableNumber) {
      return apiErrors.badRequest("venueId and tableNumber are required");
    }

    // Uses service role because this route is consumed by unauthenticated QR customers.
    // Keep selected columns minimal and bounded to reduce exposure.
    const supabase = createAdminClient();

    const { data: activeOrders, error } = await supabase
      .from("orders")
      .select(
        "id, venue_id, table_number, customer_name, total_amount, items, order_status, payment_status, payment_method, payment_mode, created_at"
      )
      .eq("venue_id", venueId)
      .eq("table_number", tableNumber)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "OUT_FOR_DELIVERY", "SERVING"])
      .in("payment_status", ["UNPAID", "IN_PROGRESS"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return apiErrors.database(error.message);
    }

    return success({
      orders: activeOrders || [],
    });
  } catch (_error) {
    logger.error("[orders/check-active] request failed", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
    return apiErrors.internal("Internal server error");
  }
}
