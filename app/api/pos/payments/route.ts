import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const updatePaymentSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  payment_status: z.enum(["PAID", "UNPAID", "REFUNDED"]),
  payment_mode: z.enum(["online", "pay_later", "pay_at_till"]).optional(),
});

/**
 * Update payment status for an order
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only update payments for orders in venues they have access to.
 */
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Validate input
    const body = await validateBody(updatePaymentSchema, await req.json());

    // STEP 3: Get venueId from context (already verified by withUnifiedAuth)
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 4: Business logic - Update payment status
    // Use authenticated client that respects RLS (not admin client)
    // RLS policies ensure users can only access orders for venues they have access to
    const supabase = await createClient();

    // Verify order exists and belongs to venue
    // RLS ensures user can only access orders for venues they have access to
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("venue_id")
      .eq("id", body.order_id)
      .eq("venue_id", venueId) // Explicit venue check (RLS also enforces this)
      .single();

    if (checkError || !orderCheck) {
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

    // Update order payment status
    // RLS ensures user can only update orders for venues they have access to
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", body.order_id)
      .eq("venue_id", venueId) // Explicit venue check (RLS also enforces this)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      return apiErrors.database(
        "Failed to update payment status",
        isDevelopment() ? updateError?.message : undefined
      );
    }

    // STEP 5: Return success response
    return success({ order: updatedOrder });
  } catch (error) {
    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});

/**
 * Get payment information for orders
 * SECURITY: Uses withUnifiedAuth to enforce venue access and RLS.
 * The authenticated client ensures users can only access payment information for orders in venues they have access to.
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
    const paymentStatus = searchParams.get("payment_status");
    const paymentMode = searchParams.get("payment_mode");

    // STEP 4: Business logic - Fetch payment information
    // Use authenticated client that respects RLS (not admin client)
    // RLS policies ensure users can only access orders for venues they have access to
    const supabase = await createClient();

    // RLS ensures user can only access orders for venues they have access to
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
      .eq("venue_id", venueId) // Explicit venue check (RLS also enforces this)
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
      return apiErrors.database(error.message || "Internal server error");
    }

    return success({ orders: orders || [] });
  } catch (error) {
    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});
