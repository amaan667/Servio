import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { paginationSchema, validateQuery } from "@/lib/api/validation-schemas";
import { z } from "zod";
import { normalizeVenueId } from "@/lib/utils/venueId";

// GET - List active questions for venue (public endpoint for customers)
export async function GET(req: NextRequest) {
  try {
    // Public endpoint: protect against scraping/abuse
    const rateResult = await rateLimit(req, RATE_LIMITS.STRICT);
    if (!rateResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateResult.reset - Date.now()) / 1000));
    }

    const { searchParams } = new URL(req.url);

    const querySchema = paginationSchema.extend({
      venueId: z.string().min(1, "venueId required").max(64),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    });

    const { venueId, limit, offset } = validateQuery(querySchema, {
      venueId: searchParams.get("venueId"),
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
    });

    // Normalize venueId - database stores with venue- prefix
    const normalizedVenueId = normalizeVenueId(venueId) ?? venueId;

    const serviceClient = await createAdminClient();

    // Get active questions for the venue
    // Try to order by display_order first, fall back to created_at if column doesn't exist
    let questions;
    let error;
    let count: number | null = null;

    const resultWithDisplayOrder = await serviceClient
      .from("feedback_questions")
      .select("*", { count: "exact" })
      .eq("venue_id", normalizedVenueId)
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    questions = resultWithDisplayOrder.data;
    error = resultWithDisplayOrder.error;
    count = resultWithDisplayOrder.count;

    // If error is about missing display_order column, retry without it
    if (
      error &&
      error.message?.toLowerCase().includes("display_order") &&
      (error.message?.toLowerCase().includes("column") ||
        error.message?.toLowerCase().includes("could not find"))
    ) {

      const resultWithoutDisplayOrder = await serviceClient
        .from("feedback_questions")
        .select("*", { count: "exact" })
        .eq("venue_id", normalizedVenueId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);

      questions = resultWithoutDisplayOrder.data;
      error = resultWithoutDisplayOrder.error;
      count = resultWithoutDisplayOrder.count;
    }

    if (error) {

      return apiErrors.internal("Failed to fetch questions");
    }

    // Transform questions to match frontend expectations (prompt, type, choices)
    const transformedQuestions = (questions || []).map(
      (q: {
        id: string;
        question?: string;
        question_text?: string;
        question_type: string;
        options?: string[] | null;
        is_active: boolean;
        display_order?: number;
        created_at: string;
        updated_at: string;
        venue_id: string;
      }) => ({
        id: q.id,
        prompt: q.question_text || q.question || "", // Map 'question_text' or 'question' to 'prompt' for frontend
        type: q.question_type, // Map 'question_type' to 'type' for frontend
        choices: q.options || [], // Map 'options' to 'choices' for frontend
        is_active: q.is_active,
        sort_index: q.display_order ?? 0, // Map 'display_order' to 'sort_index' for frontend, default to 0 if missing
        created_at: q.created_at,
        updated_at: q.updated_at,
        venue_id: q.venue_id,
      })
    );

    const total = typeof count === "number" ? count : transformedQuestions.length;

    return NextResponse.json({
      questions: transformedQuestions,
      count: total,
      pagination: {
        limit,
        offset,
        returned: transformedQuestions.length,
        hasMore: total > offset + transformedQuestions.length,
      },
    });
  } catch (_error) {

    return apiErrors.internal("Internal server error");
  }
}
