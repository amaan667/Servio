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
      // Try to order by display_order first, fall back to created_at if column doesn't exist
      let questions;
      let error;
      
      const resultWithDisplayOrder = await supabase
        .from("feedback_questions")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      
      questions = resultWithDisplayOrder.data;
      error = resultWithDisplayOrder.error;
      
      // If error is about missing display_order column, retry without it
      if (error && error.message?.toLowerCase().includes("display_order") && 
          (error.message?.toLowerCase().includes("column") || error.message?.toLowerCase().includes("could not find"))) {
        logger.warn("[FEEDBACK QUESTIONS GET] display_order column not found, ordering by created_at only", {
          error: error.message,
        });
        
        const resultWithoutDisplayOrder = await supabase
          .from("feedback_questions")
          .select("*")
          .eq("venue_id", normalizedVenueId)
          .order("created_at", { ascending: true });
        
        questions = resultWithoutDisplayOrder.data;
        error = resultWithoutDisplayOrder.error;
      }

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
        question_text?: string;
        question?: string;
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
    
    // CRITICAL: Use both logger AND direct stdout for Railway
    const logPrefix = `[FEEDBACK QUESTIONS POST ${requestId}]`;
    const logMessage = `${logPrefix} ===== ADD QUESTION CLICKED =====`;
    
    // Log to both logger and stdout for Railway
    logger.info(logMessage);
    if (typeof process !== 'undefined' && process.stdout) {
      process.stdout.write(`${new Date().toISOString()} ${logMessage}\n`);
    }
    
    logger.info(`${logPrefix} Request started`, {
      timestamp: new Date().toISOString(),
      requestId,
      url: req.url,
      method: req.method,
    });
    
    if (typeof process !== 'undefined' && process.stdout) {
      process.stdout.write(`${new Date().toISOString()} ${logPrefix} Request started - URL: ${req.url}, Method: ${req.method}\n`);
    }
    
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      logger.info(`${logPrefix} Step 1: Checking rate limit`);
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Step 1: Checking rate limit\n`);
      }
      
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        const rateLimitMsg = `${logPrefix} Rate limit exceeded`;
        logger.warn(rateLimitMsg);
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${rateLimitMsg}\n`);
        }
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }
      
      logger.info(`${logPrefix} Rate limit check passed`);
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Rate limit check passed\n`);
      }

      // STEP 2: Get venueId from context (already verified)
      logger.info(`${logPrefix} Step 2: Getting venueId from context`);
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Step 2: Getting venueId from context\n`);
      }
      
      const venueId = context.venueId;
      
      logger.info(`${logPrefix} Context venueId: ${venueId || "MISSING"}`, {
        venueId: venueId || "MISSING",
        userId: context.user?.id || "MISSING",
        hasUser: !!context.user,
      });
      
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Context venueId: ${venueId || "MISSING"}, UserId: ${context.user?.id || "MISSING"}\n`);
      }
      
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
      logger.info(`${logPrefix} Step 3: Parsing request body`);
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Step 3: Parsing request body\n`);
      }
      
      let body;
      try {
        const rawBody = await req.json().catch((parseError) => {
          const errorMsg = `${logPrefix} Failed to parse request body: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
          logger.error(errorMsg, {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            errorName: parseError instanceof Error ? parseError.name : typeof parseError,
            venueId: normalizedVenueId,
          });
          if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
          }
          throw new Error("Invalid JSON in request body");
        });
        
        logger.info(`${logPrefix} Raw body parsed successfully`, {
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
        
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${logPrefix} Raw body parsed - prompt: ${rawBody?.prompt?.substring(0, 30)}..., type: ${rawBody?.type}, venue_id: ${rawBody?.venue_id}\n`);
        }
        
        logger.info(`${logPrefix} Validating body against schema`);
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${logPrefix} Validating body against schema\n`);
        }
        
        body = await validateBody(createQuestionSchema, rawBody);
        logger.info(`${logPrefix} Body validation passed`, {
          prompt: body.prompt,
          type: body.type,
          venue_id: body.venue_id,
          is_active: body.is_active,
          choicesCount: body.choices?.length || 0,
        });
        
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${logPrefix} Body validation passed - prompt: ${body.prompt.substring(0, 30)}..., type: ${body.type}\n`);
        }
      } catch (error) {
        const errorMsg = `${logPrefix} Body validation error: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg, {
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : typeof error,
          venueId: normalizedVenueId,
          userId: context.user?.id,
          isZodError: isZodError(error),
          errorDetails: isZodError(error) ? (error as z.ZodError).errors : undefined,
        });
        
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        }
        
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

      // Get current max display_order for this venue
      // Handle case where display_order column might not exist
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 4a: Getting max display_order`);
      let nextDisplayOrder = body.sort_index ?? 0;
      let displayOrderColumnExists = false;
      
      const { data: existingQuestions, error: sortIndexError } = await supabase
        .from("feedback_questions")
        .select("display_order")
        .eq("venue_id", normalizedVenueId)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sortIndexError) {
        // Check if error is about missing column
        const isDisplayOrderColumnError = sortIndexError.message?.toLowerCase().includes("display_order") &&
          (sortIndexError.message?.toLowerCase().includes("column") || 
           sortIndexError.message?.toLowerCase().includes("could not find"));
        
        if (isDisplayOrderColumnError) {
          logger.warn(`[FEEDBACK QUESTIONS POST ${requestId}] display_order column not found, will insert without it`, {
            error: sortIndexError.message,
          });
          displayOrderColumnExists = false;
        } else {
          logger.warn(`[FEEDBACK QUESTIONS POST ${requestId}] Error fetching existing questions for display_order`, {
            error: sortIndexError.message,
          });
        }
      } else {
        // Column exists, calculate next display order
        displayOrderColumnExists = true;
        nextDisplayOrder = existingQuestions?.display_order !== undefined
          ? (existingQuestions.display_order + 1)
          : (body.sort_index ?? 0);
      }
      
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Display order calculated`, {
        existingMax: existingQuestions?.display_order,
        nextDisplayOrder,
        displayOrderColumnExists,
      });

      // Prepare insert data
      // CRITICAL: Check if options column exists by trying a test query first
      // If it doesn't exist, we'll insert without it
      const insertDataBase: Record<string, unknown> = {
        venue_id: normalizedVenueId,
        question_text: body.prompt, // Map 'prompt' to 'question_text' for DB (Supabase expects snake_case)
        question_type: body.type, // Map 'type' to 'question_type' for DB
        is_active: body.is_active ?? true,
      };
      
      // Only include display_order if the column exists
      if (displayOrderColumnExists) {
        insertDataBase.display_order = body.sort_index ?? nextDisplayOrder; // Map 'sort_index' to 'display_order' for DB
      }
      
      const insertData: Record<string, unknown> = {
        ...insertDataBase,
      };
      
      // Try to include options if we have choices
      // If the column doesn't exist, Supabase will ignore it or we'll catch the error
      // For now, let's NOT include options by default since the column doesn't exist
      // Only include it if explicitly needed (but we'll handle the error if it fails)
      // Actually, let's just not include it at all since the column doesn't exist
      // The retry logic will handle it if we do include it
      // For stars and paragraph types, we don't need options anyway
      if (body.type === "multiple_choice" && body.choices && Array.isArray(body.choices) && body.choices.length > 0) {
        // Only include options for multiple_choice questions with choices
        insertData.options = body.choices;
      }
      // For stars and paragraph types, don't include options at all
      
      logger.info(`${logPrefix} Step 4b: Inserting question into database`);
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Step 4b: Inserting question into database\n`);
      }
      
      logger.info(`${logPrefix} Insert data prepared`, {
        insertData: {
          venue_id: insertDataBase.venue_id,
          question_text: insertDataBase.question_text.substring(0, 50) + "...",
          question_type: insertDataBase.question_type,
          is_active: insertDataBase.is_active,
          display_order: insertDataBase.display_order,
          optionsCount: Array.isArray(insertData.options) ? insertData.options.length : 0,
        },
      });

      // Try insert with options first, if it fails due to missing column, retry without it
      let question;
      let error;
      
      const insertResult = await supabase
        .from("feedback_questions")
        .insert(insertData)
        .select()
        .single();
      
      question = insertResult.data;
      error = insertResult.error;
      
      // Log error details for debugging
      if (error) {
        logger.info(`${logPrefix} Initial insert error: ${error.message}`, {
          errorMessage: error.message,
          errorCode: error.code,
          hasOptions: 'options' in insertData,
          hasDisplayOrder: 'display_order' in insertData,
        });
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${logPrefix} Initial insert error: ${error.message}\n`);
        }
      }
      
      // If error is about missing column(s), retry without them
      // Check multiple possible error message patterns
      const isColumnError = error && (
        (error.message?.toLowerCase().includes("column") && error.message?.toLowerCase().includes("could not find")) ||
        error.message?.toLowerCase().includes("could not find") ||
        error.code === "PGRST116" || // PostgREST error code for missing column
        error.code === "42703" // PostgreSQL error code for undefined column
      );
      
      if (isColumnError) {
        // Determine which column(s) are missing
        const isOptionsColumnError = error.message?.toLowerCase().includes("options");
        const isDisplayOrderColumnError = error.message?.toLowerCase().includes("display_order");
        
        if (isOptionsColumnError || isDisplayOrderColumnError) {
          const retryMsg = `${logPrefix} Column(s) not found (options: ${isOptionsColumnError}, display_order: ${isDisplayOrderColumnError}), retrying insert without missing columns`;
          logger.warn(retryMsg);
          if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write(`${new Date().toISOString()} ${retryMsg}\n`);
          }
          
          const insertDataRetry = { ...insertData };
          if (isOptionsColumnError && 'options' in insertDataRetry) {
            delete insertDataRetry.options;
          }
          if (isDisplayOrderColumnError && 'display_order' in insertDataRetry) {
            delete insertDataRetry.display_order;
          }
          
          logger.info(`${logPrefix} Retrying insert without missing columns`);
          if (typeof process !== 'undefined' && process.stdout) {
            process.stdout.write(`${new Date().toISOString()} ${logPrefix} Retrying insert without missing columns\n`);
          }
          
          const retryResult = await supabase
            .from("feedback_questions")
            .insert(insertDataRetry)
            .select()
            .single();
          
          question = retryResult.data;
          error = retryResult.error;
          
          if (error) {
            logger.error(`${logPrefix} Retry insert also failed: ${error.message}`);
            if (typeof process !== 'undefined' && process.stdout) {
              process.stdout.write(`${new Date().toISOString()} ${logPrefix} Retry insert also failed: ${error.message}\n`);
            }
          } else {
            logger.info(`${logPrefix} Retry insert succeeded without missing columns`);
            if (typeof process !== 'undefined' && process.stdout) {
              process.stdout.write(`${new Date().toISOString()} ${logPrefix} Retry insert succeeded without missing columns\n`);
            }
          }
        }
      }

      if (error) {
        const errorMsg = `${logPrefix} ERROR: Database insert failed - ${error.message}`;
        logger.error(errorMsg, {
          error: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          venueId: normalizedVenueId,
          userId: context.user?.id,
          insertData: {
            venue_id: insertDataBase.venue_id,
            question_text_length: typeof insertDataBase.question_text === 'string' ? insertDataBase.question_text.length : 0,
            question_type: insertDataBase.question_type,
            is_active: insertDataBase.is_active,
            display_order: 'display_order' in insertDataBase ? insertDataBase.display_order : 'not included',
            hasOptions: !!insertData.options,
          },
        });
        
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        }
        
        return apiErrors.database(
          "Failed to create question",
          isDevelopment() ? error.message : undefined
        );
      }

      if (!question) {
        const errorMsg = `${logPrefix} ERROR: Question insert returned no data`;
        logger.error(errorMsg, {
          venueId: normalizedVenueId,
          userId: context.user?.id,
          insertData: {
            venue_id: insertData.venue_id,
            question_type: insertData.question_type,
          },
        });
        
        if (typeof process !== 'undefined' && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        }
        
        return apiErrors.database("Failed to create question - no data returned");
      }

      const successMessage = `${logPrefix} ✅ Question created successfully - ID: ${question.id}, Duration: ${Date.now() - startTime}ms`;
      logger.info(successMessage, {
        questionId: question.id,
        venueId: normalizedVenueId,
        userId: context.user?.id,
        questionText: (question.question_text || question.question || "")?.substring(0, 50) + "...",
        questionType: question.question_type,
        duration: Date.now() - startTime,
      });
      
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${successMessage}\n`);
      }

      // STEP 5: Transform question to match frontend expectations
      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Step 5: Transforming question for frontend`);
      const transformedQuestion = {
        id: question.id,
        prompt: question.question_text || question.question, // Map 'question_text' or 'question' to 'prompt'
        type: question.question_type, // Map 'question_type' to 'type'
        choices: question.options || [], // Map 'options' to 'choices'
        is_active: question.is_active,
        sort_index: (question as { display_order?: number }).display_order ?? 0, // Map 'display_order' to 'sort_index', default to 0 if missing
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
      logger.info(`${logPrefix} Step 6: Returning success response`, {
        hasQuestion: !!transformedQuestion,
        questionId: transformedQuestion.id,
        totalDuration: Date.now() - startTime,
      });
      
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Step 6: Returning success response - Question ID: ${transformedQuestion.id}\n`);
      }
      
      const response = success({ question: transformedQuestion });
      const finalSuccessMsg = `${logPrefix} ===== SUCCESS - Question created ===== ID: ${transformedQuestion.id}, Duration: ${Date.now() - startTime}ms`;
      logger.info(finalSuccessMsg, {
        questionId: transformedQuestion.id,
        duration: Date.now() - startTime,
      });
      
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${finalSuccessMsg}\n`);
      }
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const duration = Date.now() - startTime;
      
      const errorMsg = `${logPrefix} ===== UNEXPECTED ERROR ===== ${errorMessage}`;
      logger.error(errorMsg, {
        error: errorMessage,
        errorName: error instanceof Error ? error.name : typeof error,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user?.id,
        duration,
        url: req.url,
        method: req.method,
      });
      
      if (typeof process !== 'undefined' && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        if (errorStack) {
          process.stdout.write(`${new Date().toISOString()} ${logPrefix} Stack: ${errorStack.substring(0, 500)}\n`);
        }
      }

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
      if (body.sort_index !== undefined) updateData.display_order = body.sort_index; // Map 'sort_index' to 'display_order'
      // Only include options if choices are provided (column might not exist)
      if (body.choices !== undefined && Array.isArray(body.choices)) {
        updateData.options = body.choices; // Map 'choices' to 'options'
      }

      // Try update with all fields first, if it fails due to missing column, retry without it
      let question;
      let error;
      
      const updateResult = await supabase
        .from("feedback_questions")
        .update(updateData)
        .eq("id", body.id)
        .eq("venue_id", normalizedVenueId)
        .select()
        .single();
      
      question = updateResult.data;
      error = updateResult.error;
      
      // If error is about missing column(s), retry without them
      const isColumnError = error && (
        (error.message?.toLowerCase().includes("column") && error.message?.toLowerCase().includes("could not find")) ||
        error.message?.toLowerCase().includes("could not find") ||
        error.code === "PGRST116" || // PostgREST error code for missing column
        error.code === "42703" // PostgreSQL error code for undefined column
      );
      
      if (isColumnError) {
        // Determine which column(s) are missing
        const isOptionsColumnError = error.message?.toLowerCase().includes("options");
        const isDisplayOrderColumnError = error.message?.toLowerCase().includes("display_order");
        
        if (isOptionsColumnError || isDisplayOrderColumnError) {
          logger.warn("[FEEDBACK QUESTIONS PATCH] Column(s) not found, retrying update without missing columns", {
            isOptionsColumnError,
            isDisplayOrderColumnError,
          });
          
          const updateDataRetry = { ...updateData };
          if (isOptionsColumnError && 'options' in updateDataRetry) {
            delete updateDataRetry.options;
          }
          if (isDisplayOrderColumnError && 'display_order' in updateDataRetry) {
            delete updateDataRetry.display_order;
          }
          
          const retryResult = await supabase
            .from("feedback_questions")
            .update(updateDataRetry)
            .eq("id", body.id)
            .eq("venue_id", normalizedVenueId)
            .select()
            .single();
          
          question = retryResult.data;
          error = retryResult.error;
        }
      }

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
        prompt: question.question_text || question.question || "", // Map 'question_text' or 'question' to 'prompt'
        type: question.question_type, // Map 'question_type' to 'type'
        choices: question.options || [], // Map 'options' to 'choices'
        is_active: question.is_active,
        sort_index: (question as { display_order?: number }).display_order ?? 0, // Map 'display_order' to 'sort_index', default to 0 if missing
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
