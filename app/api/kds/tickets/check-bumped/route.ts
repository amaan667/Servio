import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const checkBumpedSchema = z.object({
  order_id: z.string().min(1, "Order ID is required"),
  venue_id: z.string().min(1, "Venue ID is required").optional(),

// POST - Check if all KDS tickets for an order are bumped
// This endpoint can be called without auth (for OrderCard component)
export async function POST(req: NextRequest) {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
    }

    // STEP 2: Validate input - handle case where venueId might be missing
    let body;
    try {
      const requestBody = await req.json();
      
      body = await validateBody(checkBumpedSchema, requestBody);
    } catch (validationError) {

      if (isZodError(validationError)) {
        return handleZodError(validationError);
      }
      return apiErrors.badRequest("Invalid request body - order_id is required");
    }

    const orderId = body.order_id;
    const venueIdFromBody = body.venue_id;

    // STEP 3: Get venueId from body or extract from order
    const supabase = createAdminClient();
    let venueId = venueIdFromBody;

    // If venueId not in body, extract from order
    if (!venueId && orderId) {
      const { data: order } = await supabase
        .from("orders")
        .select("venue_id")
        .eq("id", orderId)
        .single();
      if (order?.venue_id) {
        venueId = order.venue_id;
      }
    }

    if (!venueId) {
      return apiErrors.badRequest(
        "venue_id is required (provide in body or it will be extracted from order)"
      );
    }

    // STEP 4: Business logic - Check if all tickets are bumped

    // Get all tickets for this order
    const { data: tickets, error: fetchError } = await supabase
      .from("kds_tickets")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("venue_id", venueId);

    if (fetchError) {
      
      return apiErrors.database(
        "Failed to check ticket status",
        isDevelopment() ? fetchError.message : undefined
      );
    }

    // If no tickets exist, consider it as "all bumped" (order might not have KDS tickets)
    if (!tickets || tickets.length === 0) {
      
      return success({ all_bumped: true, ticket_count: 0 });
    }

    // Check if all tickets are bumped
    const allBumped = tickets.every((t) => t.status === "bumped");
    const bumpedCount = tickets.filter((t) => t.status === "bumped").length;

    

    // STEP 5: Return success response
    return success({

  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
}
