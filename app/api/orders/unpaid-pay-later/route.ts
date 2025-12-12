import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

/**
 * GET /api/orders/unpaid-pay-later
 *
 * Finds unpaid Pay Later orders for a specific table/venue.
 * Used when customer re-scans QR code to pay for existing unpaid order.
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    const tableNumber = searchParams.get("tableNumber");
    const tableId = searchParams.get("tableId");

    if (!venueId) {
      return apiErrors.badRequest("venueId is required");
    }

    if (!tableNumber && !tableId) {
      return apiErrors.badRequest("tableNumber or tableId is required");
    }

    const supabase = createAdminClient();

    // Build query to find unpaid Pay Later orders
    let query = supabase
      .from("orders")
      .select(
        "id, venue_id, table_number, table_id, customer_name, customer_phone, customer_email, total_amount, items, payment_status, payment_method, payment_mode, order_status, created_at"
      )
      .eq("venue_id", venueId)
      .eq("payment_method", "PAY_LATER")
      .eq("payment_status", "UNPAID")
      .in("order_status", ["PLACED", "IN_PREP", "READY", "SERVING", "SERVED"])
      .order("created_at", { ascending: false })
      .limit(1); // Get most recent unpaid order

    if (tableId) {
      query = query.eq("table_id", tableId);
    } else if (tableNumber) {
      query = query.eq("table_number", tableNumber);
    }

    const { data: orders, error } = await query;

    if (error) {
      logger.error("[UNPAID PAY LATER] Database error:", {
        error: error.message,
        venueId,
        tableNumber,
        tableId,
      });
      return apiErrors.database("Failed to find unpaid orders", error.message);
    }

    // Return the most recent unpaid order if found
    const unpaidOrder = orders && orders.length > 0 ? orders[0] : null;

    return success({
      hasUnpaidOrder: !!unpaidOrder,
      order: unpaidOrder,
    });
  } catch (error) {
    logger.error("[UNPAID PAY LATER] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return apiErrors.internal(
      "Failed to check for unpaid orders",
      error instanceof Error ? error.message : undefined
    );
  }
}
