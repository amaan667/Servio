import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateBody, submitFeedbackSchema } from "@/lib/api/validation-schemas";
import { success, apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

/**
 * POST /api/feedback-responses
 * Submit feedback responses for an order
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      let venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Validate input
      const body = await validateBody(submitFeedbackSchema, await req.json());

      // Normalize venue IDs for comparison (database may store with venue- prefix)
      const normalizeVenueId = (id: string) => (id.startsWith("venue-") ? id : `venue-${id}`);
      const normalizedContextVenueId = normalizeVenueId(venueId);
      const normalizedBodyVenueId = normalizeVenueId(body.venue_id);

      // Verify venue_id matches context
      if (normalizedBodyVenueId !== normalizedContextVenueId) {
        return apiErrors.forbidden("Venue ID mismatch");
      }

      // Use normalized venueId for database operations
      venueId = normalizedContextVenueId;

      // STEP 4: Security - Verify order belongs to venue if order_id provided
      if (body.order_id) {
        const supabase = await createClient();
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("venue_id")
          .eq("id", body.order_id)
          .eq("venue_id", venueId)
          .single();

        if (orderError || !order) {

          return apiErrors.notFound("Order not found or access denied");
        }
      }

      // STEP 5: Business logic - Insert feedback responses
      const supabase = await createClient();

      const responsesToInsert = body.answers.map((answer) => ({
        venue_id: venueId,
        question_id: answer.question_id,
        order_id: body.order_id || null,
        answer_type: answer.answer_type,
        answer_stars: answer.answer_stars || null,
        answer_choice: answer.answer_choice || null,
        answer_text: answer.answer_text || null,
      }));

      const { data: insertedResponses, error: insertError } = await supabase
        .from("feedback_responses")
        .insert(responsesToInsert)
        .select();

      if (insertError || !insertedResponses) {

        return apiErrors.database("Failed to save feedback responses", insertError);
      }

      // STEP 6: Return success response

      return success({
        responses: insertedResponses,
      });
    } catch (error) {

      // Handle validation errors
      const { isZodError, handleZodError } = await import("@/lib/api/standard-response");
      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Failed to process feedback submission", error);
    }
  },
  {
    // Extract venueId from body for withUnifiedAuth
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);
