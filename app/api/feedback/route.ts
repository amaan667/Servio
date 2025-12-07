import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { order_id, rating, comment } = await req.json();
    const admin = await createClient();

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
      return apiErrors.badRequest("Valid rating (1-5) is required");
    }

    // Validate comment length
    const trimmedComment = comment ? comment.trim().slice(0, 500) : null;

    // Prepare data for insertion
    const feedbackData = {
      order_id: order_id || null,
      rating,
      comment: trimmedComment,
    };

    const { error } = await admin.from("order_feedback").insert(feedbackData);

    if (error) {
      logger.error("[FEEDBACK] Feedback submission error", {
        error: error.message,
      });
      return apiErrors.database(error.message);
    }

    return success({});
  } catch (_e) {
    const errorMessage = _e instanceof Error ? _e.message : "Unknown error";
    logger.error("[FEEDBACK] Feedback submission exception", {
      error: errorMessage,
    });
    return apiErrors.internal(errorMessage);
  }
}
