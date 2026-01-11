import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const bulkUpdateTicketsSchema = z.object({
  ticket_ids: z.array(z.string().uuid()).min(1, "At least one ticket ID is required"),
  status: z.enum(["ready", "preparing", "bumped", "served", "cancelled"]),

// PATCH - Bulk update multiple tickets (e.g., bump all ready tickets for an order)
export const PATCH = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Validate input
    const body = await validateBody(bulkUpdateTicketsSchema, await req.json());
    const { ticket_ids, status, order_id: orderId } = body;

    // STEP 3: Get venueId from context
    const venueId = context.venueId;

    if (!venueId) {
      return apiErrors.badRequest("venue_id is required");
    }

    // STEP 4: Business logic - Update tickets
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: tickets, error: updateError } = await supabase
      .from("kds_tickets")
      .update({
        status,

      .in("id", ticket_ids)
      .eq("venue_id", venueId)
      .select();

    if (updateError) {
      
      return apiErrors.database(
        "Failed to update tickets",
        isDevelopment() ? updateError.message : undefined
      );
    }

    // STEP 5: If bumping tickets, check if ALL tickets for this order are now bumped
    if (status === "bumped" && orderId) {
      // Check if all tickets for this order are bumped
      const { data: allOrderTickets } = await supabase
        .from("kds_tickets")
        .select("id, status")
        .eq("order_id", orderId)
        .eq("venue_id", venueId);

      const allBumped = allOrderTickets?.every((t) => t.status === "bumped") || false;

       => t.status === "bumped").length,
        allBumped,

      // Only update order status if ALL tickets are bumped
      if (allBumped) {
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("order_status, kitchen_status")
          .eq("id", orderId)
          .eq("venue_id", venueId)
          .single();

        ?.kitchen_status,

        const { error: orderUpdateError } = await supabase.rpc("orders_set_kitchen_bumped", {

        if (orderUpdateError) {
          
        } else {
          
        }
      } else {
         => t.status === "bumped").length,

      }
    }

    

    // STEP 6: Return success response
    return success({

  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
