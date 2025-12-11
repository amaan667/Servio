import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clear tables for all completed/cancelled orders
 * Call: POST /api/tables/clear-completed
 */
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 3: Business logic - Find completed orders and clear their table sessions
    const supabase = createAdminClient();

    // Find all orders that are completed or cancelled and have a table
    const { data: completedOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, table_id, table_number")
      .eq("venue_id", venueId)
      .in("order_status", ["COMPLETED", "CANCELLED"]);

    if (ordersError) {
      logger.error("[CLEAR COMPLETED TABLES] Error fetching completed orders:", {
        error: ordersError.message,
        venueId,
        userId: context.user.id,
      });
      return apiErrors.database(
        "Failed to fetch completed orders",
        isDevelopment() ? ordersError.message : undefined
      );
    }

    if (!completedOrders || completedOrders.length === 0) {
      return success({
        message: "No completed orders found",
        cleared: 0,
        orderIds: [],
      });
    }

    const orderIds = completedOrders.map((o) => o.id);
    const tableIds = completedOrders.map((o) => o.table_id).filter((id): id is string => !!id);

    if (tableIds.length === 0) {
      return success({
        message: "No tables to clear",
        cleared: 0,
        orderIds,
      });
    }

    // Close table sessions for these tables
    const { data: clearedSessions, error: clearError } = await supabase
      .from("table_sessions")
      .update({
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("table_id", tableIds)
      .eq("venue_id", venueId)
      .is("closed_at", null)
      .select();

    if (clearError) {
      logger.error("[CLEAR COMPLETED TABLES] Error clearing table sessions:", {
        error: clearError.message,
        venueId,
        userId: context.user.id,
      });
      return apiErrors.database(
        "Failed to clear table sessions",
        isDevelopment() ? clearError.message : undefined
      );
    }

    logger.info("[CLEAR COMPLETED TABLES] Cleared table sessions", {
      count: clearedSessions?.length || 0,
      venueId,
      userId: context.user.id,
    });

    return success({
      message: `Cleared ${clearedSessions?.length || 0} table sessions`,
      cleared: clearedSessions?.length || 0,
      orderIds,
    });
  } catch (error) {
    logger.error("[CLEAR COMPLETED TABLES] Error:", {
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
