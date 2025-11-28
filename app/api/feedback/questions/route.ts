import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { isDevelopment } from '@/lib/env';
import { z } from 'zod';
import { validateBody, validateQuery } from '@/lib/api/validation-schemas';

// Validation schemas
const createQuestionSchema = z.object({
  venue_id: z.string().uuid(),
  question_text: z.string().min(1).max(500),
  question_type: z.enum(["stars", "multiple_choice", "paragraph"]),
  is_active: z.boolean().default(true),
  sort_index: z.number().int().nonnegative().optional(),
  options: z.array(z.string()).optional(),
});

const updateQuestionSchema = createQuestionSchema.partial().extend({
  id: z.string().uuid(),
});

const deleteQuestionSchema = z.object({
  id: z.string().uuid(),
});

// GET - List questions for venue
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Business logic
      const supabase = await createClient();

      // Get questions (all questions since we don't have soft delete yet)
      const { data: questions, error } = await supabase
        .from("feedback_questions")
        .select("*")
        .eq("venue_id", venueId)
        .order("sort_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        logger.error("[FEEDBACK QUESTIONS GET] Error fetching questions:", {
          error: error.message,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch questions",
          isDevelopment() ? error.message : undefined
        );
      }

      // Calculate total count (all questions) and active count
      const totalCount = questions?.length || 0;
      const activeCount = questions?.filter((q) => q.is_active).length || 0;

      // STEP 4: Return success response
      return success({
        questions: questions || [],
        totalCount,
        activeCount,
      });
    } catch (error) {
      logger.error("[FEEDBACK QUESTIONS GET] Unexpected error:", {
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
  },
  {
    extractVenueId: async (req) => {
      const { searchParams } = new URL(req.url);
      return searchParams.get("venueId");
    },
  }
);

// POST - Create question
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

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Validate input
      const body = await validateBody(createQuestionSchema, await req.json());

      // Verify venue_id matches context
      if (body.venue_id !== venueId) {
        return apiErrors.forbidden('Venue ID mismatch');
      }

      // STEP 4: Business logic
      const supabase = await createClient();

      // Get current max sort_index for this venue
      const { data: existingQuestions } = await supabase
        .from("feedback_questions")
        .select("sort_index")
        .eq("venue_id", venueId)
        .order("sort_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSortIndex = existingQuestions?.sort_index !== undefined
        ? (existingQuestions.sort_index + 1)
        : 0;

      const { data: question, error } = await supabase
        .from("feedback_questions")
        .insert({
          venue_id: venueId,
          question_text: body.question_text,
          question_type: body.question_type,
          is_active: body.is_active ?? true,
          sort_index: body.sort_index ?? nextSortIndex,
          options: body.options || null,
        })
        .select()
        .single();

      if (error || !question) {
        logger.error("[FEEDBACK QUESTIONS POST] Error creating question:", {
          error: error?.message,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to create question",
          isDevelopment() ? error?.message : undefined
        );
      }

      logger.info("[FEEDBACK QUESTIONS POST] Question created successfully", {
        questionId: question.id,
        venueId,
        userId: context.user.id,
      });

      // STEP 5: Return success response
      return success({ question });
    } catch (error) {
      logger.error("[FEEDBACK QUESTIONS POST] Unexpected error:", {
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
  },
  {
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (body as { venue_id?: string; venueId?: string })?.venue_id || 
               (body as { venue_id?: string; venueId?: string })?.venueId || 
               null;
      } catch {
        return null;
      }
    },
  }
);

// PATCH - Update question
export const PATCH = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Validate input
      const body = await validateBody(updateQuestionSchema, await req.json());

      // STEP 4: Security - Verify question belongs to venue
      const supabase = await createClient();
      const { data: existingQuestion, error: checkError } = await supabase
        .from("feedback_questions")
        .select("venue_id")
        .eq("id", body.id)
        .eq("venue_id", venueId)
        .single();

      if (checkError || !existingQuestion) {
        logger.warn("[FEEDBACK QUESTIONS PATCH] Question not found or access denied", {
          questionId: body.id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Question not found or access denied");
      }

      // STEP 5: Business logic - Update question
      const updateData: Record<string, unknown> = {};
      if (body.question_text !== undefined) updateData.question_text = body.question_text;
      if (body.question_type !== undefined) updateData.question_type = body.question_type;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.sort_index !== undefined) updateData.sort_index = body.sort_index;
      if (body.options !== undefined) updateData.options = body.options;

      const { data: question, error } = await supabase
        .from("feedback_questions")
        .update(updateData)
        .eq("id", body.id)
        .eq("venue_id", venueId)
        .select()
        .single();

      if (error || !question) {
        logger.error("[FEEDBACK QUESTIONS PATCH] Error updating question:", {
          error: error?.message,
          questionId: body.id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to update question",
          isDevelopment() ? error?.message : undefined
        );
      }

      logger.info("[FEEDBACK QUESTIONS PATCH] Question updated successfully", {
        questionId: body.id,
        venueId,
        userId: context.user.id,
      });

      // STEP 6: Return success response
      return success({ question });
    } catch (error) {
      logger.error("[FEEDBACK QUESTIONS PATCH] Unexpected error:", {
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
  },
  {
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (body as { venue_id?: string; venueId?: string })?.venue_id || 
               (body as { venue_id?: string; venueId?: string })?.venueId || 
               null;
      } catch {
        return null;
      }
    },
  }
);

// DELETE - Delete question
export const DELETE = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Validate input
      const { searchParams } = new URL(req.url);
      const query = validateQuery(deleteQuestionSchema, {
        id: searchParams.get("id"),
      });

      // STEP 4: Security - Verify question belongs to venue
      const supabase = await createClient();
      const { data: existingQuestion, error: checkError } = await supabase
        .from("feedback_questions")
        .select("venue_id")
        .eq("id", query.id)
        .eq("venue_id", venueId)
        .single();

      if (checkError || !existingQuestion) {
        logger.warn("[FEEDBACK QUESTIONS DELETE] Question not found or access denied", {
          questionId: query.id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Question not found or access denied");
      }

      // STEP 5: Business logic - Delete question
      const { error } = await supabase
        .from("feedback_questions")
        .delete()
        .eq("id", query.id)
        .eq("venue_id", venueId);

      if (error) {
        logger.error("[FEEDBACK QUESTIONS DELETE] Error deleting question:", {
          error: error.message,
          questionId: query.id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to delete question",
          isDevelopment() ? error.message : undefined
        );
      }

      logger.info("[FEEDBACK QUESTIONS DELETE] Question deleted successfully", {
        questionId: query.id,
        venueId,
        userId: context.user.id,
      });

      // STEP 6: Return success response
      return success({ deleted: true });
    } catch (error) {
      logger.error("[FEEDBACK QUESTIONS DELETE] Unexpected error:", {
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
  },
  {
    extractVenueId: async (req) => {
      const { searchParams } = new URL(req.url);
      return searchParams.get("venueId");
    },
  }
);
