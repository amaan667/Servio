import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { isDevelopment } from '@/lib/env';
import { z } from 'zod';
import { validateBody, validateQuery } from '@/lib/api/validation-schemas';

// Venue ID validation - accepts UUID or "venue-" prefixed format
const venueIdSchema = z.string().refine(
  (val) => {
    // Accept UUID format
    if (z.string().uuid().safeParse(val).success) return true;
    // Accept "venue-" prefix format
    if (val.startsWith("venue-") && val.length > 6) return true;
    return false;
  },
  { message: "Invalid venue ID format. Must be a UUID or start with 'venue-'" }
);

// Validation schemas
const createQuestionSchema = z.object({
  venue_id: venueIdSchema,
  prompt: z.string().min(1).max(500), // Frontend uses 'prompt', map to 'question_text' for DB
  type: z.enum(["stars", "multiple_choice", "paragraph"]), // Frontend uses 'type', map to 'question_type' for DB
  is_active: z.boolean().default(true),
  sort_index: z.number().int().nonnegative().optional(),
  choices: z.array(z.string()).optional(), // Frontend uses 'choices', map to 'options' for DB
});

const updateQuestionSchema = createQuestionSchema.partial().extend({
  id: z.string().uuid(),
  venue_id: venueIdSchema.optional(), // Allow venue_id in updates
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
      
      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }
      
      // Normalize venueId - database stores with venue- prefix
      // Check if it already has the prefix to avoid double-prefixing
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      // STEP 3: Business logic
      const supabase = createAdminClient();

      // Get questions (all questions since we don't have soft delete yet)
      const { data: questions, error } = await supabase
        .from("feedback_questions")
        .select("*")
        .eq("venue_id", normalizedVenueId)
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

      // STEP 4: Transform questions to match frontend expectations (prompt, type, choices)
      const transformedQuestions = (questions || []).map((q: {
        id: string;
        question_text: string;
        question_type: string;
        options: string[] | null;
        is_active: boolean;
        sort_index: number;
        created_at: string;
        updated_at: string;
        venue_id: string;
      }) => ({
        id: q.id,
        prompt: q.question_text, // Map 'question_text' to 'prompt' for frontend
        type: q.question_type, // Map 'question_type' to 'type' for frontend
        choices: q.options || [], // Map 'options' to 'choices' for frontend
        is_active: q.is_active,
        sort_index: q.sort_index,
        created_at: q.created_at,
        updated_at: q.updated_at,
        venue_id: q.venue_id,
      }));

      // STEP 5: Return success response
      return success({
        questions: transformedQuestions,
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
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    
    logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] ===== ADD QUESTION CLICKED =====`);
    logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Request started`, {
      timestamp: new Date().toISOString(),
      requestId,
      url: req.url,
      method: req.method,
    });
    
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 1: Checking rate limit`);
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        logger.warn(`[FEEDBACK QUESTIONS POST ${requestId}] Rate limit exceeded`);
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Rate limit check passed`);

      // STEP 2: Get venueId from context (already verified)
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 2: Getting venueId from context`);
      const venueId = context.venueId;
      
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Context venueId:`, {
        venueId: venueId || "MISSING",
        userId: context.user?.id || "MISSING",
        hasUser: !!context.user,
      });
      
      if (!venueId) {
        logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] ERROR: venueId is missing from context`);
        return apiErrors.badRequest("venueId is required");
      }
      
      // Normalize venueId - database stores with venue- prefix
      // Check if it already has the prefix to avoid double-prefixing
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Normalized venueId:`, {
        original: venueId,
        normalized: normalizedVenueId,
      });

      // STEP 3: Validate input
      // withUnifiedAuth reconstructs the body, so we can read it normally
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 3: Parsing request body`);
      let body;
      try {
        const rawBody = await req.json().catch((parseError) => {
          logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] Failed to parse request body`, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            errorName: parseError instanceof Error ? parseError.name : typeof parseError,
            venueId: normalizedVenueId,
          });
          throw new Error("Invalid JSON in request body");
        });
        
        logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Raw body parsed successfully`, {
          hasPrompt: !!rawBody?.prompt,
          hasType: !!rawBody?.type,
          hasVenueId: !!rawBody?.venue_id,
          hasChoices: !!rawBody?.choices,
          hasIsActive: rawBody?.is_active !== undefined,
          promptLength: rawBody?.prompt?.length || 0,
          type: rawBody?.type,
          venue_id: rawBody?.venue_id,
          choicesCount: Array.isArray(rawBody?.choices) ? rawBody.choices.length : 0,
          rawBodyKeys: Object.keys(rawBody || {}),
        });
        
        logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Validating body against schema`);
        body = await validateBody(createQuestionSchema, rawBody);
        logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Body validation passed`, {
          prompt: body.prompt,
          type: body.type,
          venue_id: body.venue_id,
          is_active: body.is_active,
          choicesCount: body.choices?.length || 0,
        });
      } catch (error) {
        logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] Body validation error`, {
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : typeof error,
          venueId: normalizedVenueId,
          userId: context.user?.id,
          isZodError: isZodError(error),
          errorDetails: isZodError(error) ? (error as z.ZodError).errors : undefined,
        });
        if (isZodError(error)) {
          return handleZodError(error);
        }
        return apiErrors.badRequest(
          error instanceof Error ? error.message : "Invalid request body"
        );
      }

      // Verify venue_id matches context (normalize both for comparison)
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 3b: Verifying venue ID match`);
      const bodyVenueId = body.venue_id.startsWith("venue-") ? body.venue_id : `venue-${body.venue_id}`;
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Venue ID comparison`, {
        bodyVenueId,
        normalizedVenueId,
        match: bodyVenueId === normalizedVenueId,
      });
      
      if (bodyVenueId !== normalizedVenueId) {
        logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] ERROR: Venue ID mismatch`, {
          bodyVenueId,
          normalizedVenueId,
        });
        return apiErrors.forbidden('Venue ID mismatch');
      }

      // STEP 4: Business logic
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 4: Creating admin client`);
      const supabase = createAdminClient();
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Admin client created`);

      // Get current max sort_index for this venue
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 4a: Getting max sort_index`);
      const { data: existingQuestions, error: sortIndexError } = await supabase
        .from("feedback_questions")
        .select("sort_index")
        .eq("venue_id", normalizedVenueId)
        .order("sort_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sortIndexError) {
        logger.warn(`[FEEDBACK QUESTIONS POST ${requestId}] Error fetching existing questions for sort_index`, {
          error: sortIndexError.message,
        });
      }

      const nextSortIndex = existingQuestions?.sort_index !== undefined
        ? (existingQuestions.sort_index + 1)
        : 0;
      
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Sort index calculated`, {
        existingMax: existingQuestions?.sort_index,
        nextSortIndex,
      });

      // Prepare insert data
      const insertData = {
        venue_id: normalizedVenueId,
        question_text: body.prompt, // Map 'prompt' to 'question_text' for DB
        question_type: body.type, // Map 'type' to 'question_type' for DB
        is_active: body.is_active ?? true,
        sort_index: body.sort_index ?? nextSortIndex,
        options: body.choices || null, // Map 'choices' to 'options' for DB
      };
      
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 4b: Inserting question into database`, {
        insertData: {
          venue_id: insertData.venue_id,
          question_text: insertData.question_text.substring(0, 50) + "...",
          question_type: insertData.question_type,
          is_active: insertData.is_active,
          sort_index: insertData.sort_index,
          optionsCount: Array.isArray(insertData.options) ? insertData.options.length : 0,
        },
      });

      const { data: question, error } = await supabase
        .from("feedback_questions")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] ERROR: Database insert failed`, {
          error: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          venueId: normalizedVenueId,
          userId: context.user?.id,
          insertData: {
            venue_id: insertData.venue_id,
            question_text_length: insertData.question_text.length,
            question_type: insertData.question_type,
            is_active: insertData.is_active,
            sort_index: insertData.sort_index,
            hasOptions: !!insertData.options,
          },
        });
        return apiErrors.database(
          "Failed to create question",
          isDevelopment() ? error.message : undefined
        );
      }

      if (!question) {
        logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] ERROR: Question insert returned no data`, {
          venueId: normalizedVenueId,
          userId: context.user?.id,
          insertData: {
            venue_id: insertData.venue_id,
            question_type: insertData.question_type,
          },
        });
        return apiErrors.database("Failed to create question - no data returned");
      }

      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] ✅ Question created successfully`, {
        questionId: question.id,
        venueId: normalizedVenueId,
        userId: context.user?.id,
        questionText: question.question_text?.substring(0, 50) + "...",
        questionType: question.question_type,
        duration: Date.now() - startTime,
      });

      // STEP 5: Transform question to match frontend expectations
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 5: Transforming question for frontend`);
      const transformedQuestion = {
        id: question.id,
        prompt: question.question_text, // Map 'question_text' to 'prompt'
        type: question.question_type, // Map 'question_type' to 'type'
        choices: question.options || [], // Map 'options' to 'choices'
        is_active: question.is_active,
        sort_index: question.sort_index,
        created_at: question.created_at,
        updated_at: question.updated_at,
        venue_id: question.venue_id,
      };
      
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Question transformed`, {
        questionId: transformedQuestion.id,
        promptLength: transformedQuestion.prompt.length,
        type: transformedQuestion.type,
        choicesCount: transformedQuestion.choices.length,
      });

      // STEP 6: Return success response
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 6: Returning success response`, {
        hasQuestion: !!transformedQuestion,
        questionId: transformedQuestion.id,
        totalDuration: Date.now() - startTime,
      });
      
      const response = success({ question: transformedQuestion });
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] ===== SUCCESS - Question created =====`, {
        questionId: transformedQuestion.id,
        duration: Date.now() - startTime,
      });
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const duration = Date.now() - startTime;
      
      logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] ===== UNEXPECTED ERROR =====`, {
        error: errorMessage,
        errorName: error instanceof Error ? error.name : typeof error,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user?.id,
        duration,
        url: req.url,
        method: req.method,
      });

      if (isZodError(error)) {
        logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] Zod validation error`, {
          errors: (error as z.ZodError).errors,
        });
        return handleZodError(error);
      }

      logger.error(`[FEEDBACK QUESTIONS POST ${requestId}] Returning internal error response`);
      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? { message: errorMessage, stack: errorStack } : undefined
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
      
      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }
      
      // Normalize venueId - database stores with venue- prefix
      // Check if it already has the prefix to avoid double-prefixing
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      // STEP 3: Validate input
      const body = await validateBody(updateQuestionSchema, await req.json());

      // STEP 4: Security - Verify question belongs to venue
      const supabase = createAdminClient();
      const { data: existingQuestion, error: checkError } = await supabase
        .from("feedback_questions")
        .select("venue_id")
        .eq("id", body.id)
        .eq("venue_id", normalizedVenueId)
        .single();

      if (checkError || !existingQuestion) {
        logger.warn("[FEEDBACK QUESTIONS PATCH] Question not found or access denied", {
          questionId: body.id,
          venueId: normalizedVenueId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Question not found or access denied");
      }

      // STEP 5: Business logic - Update question (map frontend fields to DB fields)
      const updateData: Record<string, unknown> = {};
      if (body.prompt !== undefined) updateData.question_text = body.prompt; // Map 'prompt' to 'question_text'
      if (body.type !== undefined) updateData.question_type = body.type; // Map 'type' to 'question_type'
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.sort_index !== undefined) updateData.sort_index = body.sort_index;
      if (body.choices !== undefined) updateData.options = body.choices; // Map 'choices' to 'options'

      const { data: question, error } = await supabase
        .from("feedback_questions")
        .update(updateData)
        .eq("id", body.id)
        .eq("venue_id", normalizedVenueId)
        .select()
        .single();

      if (error || !question) {
        logger.error("[FEEDBACK QUESTIONS PATCH] Error updating question:", {
          error: error?.message,
          errorCode: error?.code,
          errorDetails: error?.details,
          questionId: body.id,
          venueId: normalizedVenueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to update question",
          isDevelopment() ? error?.message : undefined
        );
      }

      logger.info("[FEEDBACK QUESTIONS PATCH] Question updated successfully", {
        questionId: body.id,
        venueId: normalizedVenueId,
        userId: context.user.id,
      });

      // STEP 6: Transform question to match frontend expectations
      const transformedQuestion = {
        id: question.id,
        prompt: question.question_text, // Map 'question_text' to 'prompt'
        type: question.question_type, // Map 'question_type' to 'type'
        choices: question.options || [], // Map 'options' to 'choices'
        is_active: question.is_active,
        sort_index: question.sort_index,
        created_at: question.created_at,
        updated_at: question.updated_at,
        venue_id: question.venue_id,
      };

      // STEP 7: Return success response
      return success({ question: transformedQuestion });
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
      const { searchParams } = new URL(req.url);
      return searchParams.get("venueId");
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
      
      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }
      
      // Normalize venueId - database stores with venue- prefix
      // Check if it already has the prefix to avoid double-prefixing
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      // STEP 3: Validate input
      const { searchParams } = new URL(req.url);
      const query = validateQuery(deleteQuestionSchema, {
        id: searchParams.get("id"),
      });

      // STEP 4: Security - Verify question belongs to venue
      const supabase = createAdminClient();
      const { data: existingQuestion, error: checkError } = await supabase
        .from("feedback_questions")
        .select("venue_id")
        .eq("id", query.id)
        .eq("venue_id", normalizedVenueId)
        .single();

      if (checkError || !existingQuestion) {
        logger.warn("[FEEDBACK QUESTIONS DELETE] Question not found or access denied", {
          questionId: query.id,
          venueId: normalizedVenueId,
          userId: context.user.id,
        });
        return apiErrors.notFound("Question not found or access denied");
      }

      // STEP 5: Business logic - Delete question
      const { error } = await supabase
        .from("feedback_questions")
        .delete()
        .eq("id", query.id)
        .eq("venue_id", normalizedVenueId);

      if (error) {
        logger.error("[FEEDBACK QUESTIONS DELETE] Error deleting question:", {
          error: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          questionId: query.id,
          venueId: normalizedVenueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to delete question",
          isDevelopment() ? error.message : undefined
        );
      }

      logger.info("[FEEDBACK QUESTIONS DELETE] Question deleted successfully", {
        questionId: query.id,
        venueId: normalizedVenueId,
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
