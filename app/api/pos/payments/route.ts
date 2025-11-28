import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const updatePaymentSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  payment_status: z.enum(["PAID", "UNPAID", "REFUNDED"]),
  payment_mode: z.enum(["online", "pay_later", "pay_at_till"]).optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Validate input
      const body = await validateBody(updatePaymentSchema, await req.json());

      // STEP 3: Get venueId from context
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 4: Business logic - Update payment status
      const supabase = createAdminClient();

      // Verify order exists and belongs to venue
      const { data: orderCheck, error: checkError } = await supabase
        .from("orders")
        .select("venue_id")
        .eq("id", body.order_id)
        .eq("venue_id", venueId)
        .single();

      if (checkError || !orderCheck) {
        logger.error("[POS PAYMENTS POST] Order not found:", {
          error: checkError?.message,
          orderId: body.order_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Order not found");
      }

      // Update order payment status
      const updateData: {
        payment_status: string;
        payment_mode?: string;
        updated_at: string;
      } = {
        payment_status: body.payment_status,
        updated_at: new Date().toISOString(),
      };

      if (body.payment_mode) {
        updateData.payment_mode = body.payment_mode;
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", body.order_id)
        .eq("venue_id", venueId)
        .select()
        .single();

      if (updateError || !updatedOrder) {
        logger.error("[POS PAYMENTS POST] Error updating payment status:", {
          error: updateError?.message,
          orderId: body.order_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to update payment status",
          isDevelopment() ? updateError?.message : undefined
        );
      }

      logger.info("[POS PAYMENTS POST] Payment status updated successfully", {
        orderId: body.order_id,
        paymentStatus: body.payment_status,
        venueId,
        userId: context.user.id,
      });

      // STEP 5: Return success response
      return success({ order: updatedOrder });
    } catch (error) {
      logger.error("[POS PAYMENTS POST] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
  }
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id");
    const paymentStatus = searchParams.get("payment_status");
    const paymentMode = searchParams.get("payment_mode");

    if (!venueId) {
      return apiErrors.badRequest('venue_id is required');
    }

    // Use admin client - no auth needed (venueId is sufficient)
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    let query = supabase
      .from("orders")
      .select(
        `
        id,
        table_number,
        table_id,
        source,
        customer_name,
        payment_status,
        payment_mode,
        total_amount,
        created_at,
        tables!left (
          label
        )
      `
      )
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }

    if (paymentMode) {
      query = query.eq("payment_mode", paymentMode);
    }

    const { data: orders, error } = await query;

    if (error) {
      logger.error("[POS PAYMENTS GET] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
        venueId,
      });
      return apiErrors.database(error.message || 'Internal server error');
    }

    return success({ orders: orders || [] });
  } catch (error) {
    logger.error("[POS PAYMENTS GET] Unexpected error:", {
      error: error instanceof Error ? error.message : String(error),
      venueId: null,
    });
    return apiErrors.internal('Internal server error');
  }
}
