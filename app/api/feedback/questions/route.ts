import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { isDevelopment } from "@/lib/env";
import { z } from "zod";
import { validateBody, validateQuery } from "@/lib/api/validation-schemas";

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
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      const paginationSchema = z.object({
        limit: z.coerce.number().int().min(1).max(500).default(200),
        offset: z.coerce.number().int().min(0).default(0),
      });

      let limit = 200;
      let offset = 0;

      try {
        const pagination = validateQuery(paginationSchema, {
          limit: req.nextUrl.searchParams.get("limit"),
          offset: req.nextUrl.searchParams.get("offset"),
        });
        limit = pagination.limit;
        offset = pagination.offset;
      } catch (error) {
        if (isZodError(error)) {
          logger.warn("[FEEDBACK QUESTIONS GET] Pagination validation error, using defaults", {
            error: (error as z.ZodError).errors,
            url: req.url,
          });
          // Use defaults if validation fails
        } else {
          logger.error("[FEEDBACK QUESTIONS GET] Unexpected pagination validation error", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

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
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);

      questions = resultWithDisplayOrder.data;
      error = resultWithDisplayOrder.error;

      // If error is about missing display_order column, retry without it
      if (
        error &&
        error.message?.toLowerCase().includes("display_order") &&
        (error.message?.toLowerCase().includes("column") ||
          error.message?.toLowerCase().includes("could not find"))
      ) {
        logger.warn(
          "[FEEDBACK QUESTIONS GET] display_order column not found, ordering by created_at only",
          {
            error: error.message,
          }
        );

        const resultWithoutDisplayOrder = await supabase
          .from("feedback_questions")
          .select("*")
          .eq("venue_id", normalizedVenueId)
          .order("created_at", { ascending: true })
          .range(offset, offset + limit - 1);

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
      // Filter out questions without valid prompts and ensure prompt is always present
      const transformedQuestions = (questions || [])
        .map(
          (q: {
            id: string;
            question_text?: string;
            question?: string;
            text?: string;
            prompt?: string;
            question_type: string;
            options?: string[] | null;
            is_active: boolean;
            display_order?: number;
            created_at: string;
            updated_at: string;
            venue_id: string;
          }) => {
            // Try all possible column names for the question text
            const prompt = q.question_text || q.question || q.text || q.prompt || "";

            // Only include questions with valid prompts
            if (!prompt || prompt.trim().length === 0) {
              logger.warn("[FEEDBACK QUESTIONS GET] Question missing prompt, skipping", {
                questionId: q.id,
                venueId: normalizedVenueId,
                availableFields: Object.keys(q),
              });
              return null;
            }

            return {
              id: q.id,
              prompt: prompt.trim(), // Ensure prompt is trimmed and never empty
              type: q.question_type, // Map 'question_type' to 'type' for frontend
              choices: q.options || [], // Map 'options' to 'choices' for frontend
              is_active: q.is_active,
              sort_index: q.display_order ?? 0, // Map 'display_order' to 'sort_index' for frontend, default to 0 if missing
              created_at: q.created_at,
              updated_at: q.updated_at,
              venue_id: q.venue_id,
            };
          }
        )
        .filter((q): q is NonNullable<typeof q> => q !== null); // Remove null entries

      // STEP 5: Return success response
      return success({
        questions: transformedQuestions,
        totalCount,
        activeCount,
        pagination: {
          limit,
          offset,
          returned: transformedQuestions.length,
          hasMore: transformedQuestions.length === limit,
        },
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

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) {
          logger.warn("[FEEDBACK QUESTIONS] venueId not found in query params", {
            url: req.url,
            searchParams: Object.fromEntries(searchParams.entries()),
          });
        }
        return venueId;
      } catch (error) {
        logger.error("[FEEDBACK QUESTIONS] Error extracting venueId", {
          error: error instanceof Error ? error.message : String(error),
          url: req.url,
        });
        return null;
      }
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
    if (typeof process !== "undefined" && process.stdout) {
      process.stdout.write(`${new Date().toISOString()} ${logMessage}\n`);
    }

    logger.info(`${logPrefix} Request started`, {
      timestamp: new Date().toISOString(),
      requestId,
      url: req.url,
      method: req.method,
    });

    if (typeof process !== "undefined" && process.stdout) {
      process.stdout.write(
        `${new Date().toISOString()} ${logPrefix} Request started - URL: ${req.url}, Method: ${req.method}\n`
      );
    }

    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      logger.info(`${logPrefix} Step 1: Checking rate limit`);
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 1: Checking rate limit\n`
        );
      }

      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        const rateLimitMsg = `${logPrefix} Rate limit exceeded`;
        logger.warn(rateLimitMsg);
        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${rateLimitMsg}\n`);
        }
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      logger.info(`${logPrefix} Rate limit check passed`);
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Rate limit check passed\n`);
      }

      // STEP 2: Get venueId from context (already verified)
      logger.info(`${logPrefix} Step 2: Getting venueId from context`);
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 2: Getting venueId from context\n`
        );
      }

      const venueId = context.venueId;

      logger.info(`${logPrefix} Context venueId: ${venueId || "MISSING"}`, {
        venueId: venueId || "MISSING",
        userId: context.user?.id || "MISSING",
        hasUser: !!context.user,
      });

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Context venueId: ${venueId || "MISSING"}, UserId: ${context.user?.id || "MISSING"}\n`
        );
      }

      if (!venueId) {
        logger.error(
          `[FEEDBACK QUESTIONS POST ${requestId}] ERROR: venueId is missing from context`
        );
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
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 3: Parsing request body\n`
        );
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
          if (typeof process !== "undefined" && process.stdout) {
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

        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Raw body parsed - prompt: ${rawBody?.prompt?.substring(0, 30)}..., type: ${rawBody?.type}, venue_id: ${rawBody?.venue_id}\n`
          );
        }

        logger.info(`${logPrefix} Validating body against schema`);
        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Validating body against schema\n`
          );
        }

        body = await validateBody(createQuestionSchema, rawBody);
        logger.info(`${logPrefix} Body validation passed`, {
          prompt: body.prompt,
          type: body.type,
          venue_id: body.venue_id,
          is_active: body.is_active,
          choicesCount: body.choices?.length || 0,
        });

        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Body validation passed - prompt: ${body.prompt.substring(0, 30)}..., type: ${body.type}\n`
          );
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

        if (typeof process !== "undefined" && process.stdout) {
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
      const bodyVenueId = body.venue_id.startsWith("venue-")
        ? body.venue_id
        : `venue-${body.venue_id}`;
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
        return apiErrors.forbidden("Venue ID mismatch");
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
        const isDisplayOrderColumnError =
          sortIndexError.message?.toLowerCase().includes("display_order") &&
          (sortIndexError.message?.toLowerCase().includes("column") ||
            sortIndexError.message?.toLowerCase().includes("could not find"));

        if (isDisplayOrderColumnError) {
          logger.warn(
            `[FEEDBACK QUESTIONS POST ${requestId}] display_order column not found, will insert without it`,
            {
              error: sortIndexError.message,
            }
          );
          displayOrderColumnExists = false;
        } else {
          logger.warn(
            `[FEEDBACK QUESTIONS POST ${requestId}] Error fetching existing questions for display_order`,
            {
              error: sortIndexError.message,
            }
          );
        }
      } else {
        // Column exists, calculate next display order
        displayOrderColumnExists = true;
        nextDisplayOrder =
          existingQuestions?.display_order !== undefined
            ? existingQuestions.display_order + 1
            : (body.sort_index ?? 0);
      }

      logger.info(`[FEEDBACK QUESTIONS POST ${requestId}] Display order calculated`, {
        existingMax: existingQuestions?.display_order,
        nextDisplayOrder,
        displayOrderColumnExists,
      });

      // STEP 4b: Discover actual schema by querying an existing row
      // This will tell us what columns actually exist
      logger.info(`${logPrefix} Step 4b: Discovering schema by querying existing row`);
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 4b: Discovering schema\n`
        );
      }

      const { data: sampleQuestion, error: sampleError } = await supabase
        .from("feedback_questions")
        .select("*")
        .eq("venue_id", normalizedVenueId)
        .limit(1)
        .maybeSingle();

      if (sampleError && !sampleError.message?.toLowerCase().includes("no rows")) {
        logger.warn(`${logPrefix} Could not query sample row for schema discovery`, {
          error: sampleError.message,
        });
      }

      // Determine actual column names from sample or use defaults
      const actualColumns = {
        questionText: sampleQuestion
          ? Object.keys(sampleQuestion).find(
              (k) => k === "question" || k === "question_text" || k === "text" || k === "prompt"
            ) || "question"
          : "question",
        questionType: sampleQuestion
          ? Object.keys(sampleQuestion).find((k) => k === "question_type" || k === "type") ||
            "question_type"
          : "question_type",
        hasOptions: sampleQuestion ? "options" in sampleQuestion : false,
        hasDisplayOrder: sampleQuestion
          ? "display_order" in sampleQuestion || "sort_index" in sampleQuestion
          : false,
        displayOrderColumn: sampleQuestion
          ? Object.keys(sampleQuestion).find((k) => k === "display_order" || k === "sort_index") ||
            "display_order"
          : "display_order",
      };

      logger.info(`${logPrefix} Schema discovered`, {
        questionTextColumn: actualColumns.questionText,
        questionTypeColumn: actualColumns.questionType,
        hasOptions: actualColumns.hasOptions,
        hasDisplayOrder: actualColumns.hasDisplayOrder,
        displayOrderColumn: actualColumns.displayOrderColumn,
      });

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Schema: questionText=${actualColumns.questionText}, questionType=${actualColumns.questionType}\n`
        );
      }

      // Prepare insert data using discovered column names
      const insertDataBase: Record<string, unknown> = {
        venue_id: normalizedVenueId,
        [actualColumns.questionText]: body.prompt,
        [actualColumns.questionType]: body.type,
        is_active: body.is_active ?? true,
      };

      // Only include display_order if the column exists (from schema discovery or previous check)
      if (actualColumns.hasDisplayOrder || displayOrderColumnExists) {
        insertDataBase[actualColumns.displayOrderColumn] = body.sort_index ?? nextDisplayOrder;
      }

      const insertData: Record<string, unknown> = {
        ...insertDataBase,
      };

      // Only include options for multiple_choice questions with choices, and only if column exists
      if (
        actualColumns.hasOptions &&
        body.type === "multiple_choice" &&
        body.choices &&
        Array.isArray(body.choices) &&
        body.choices.length > 0
      ) {
        insertData.options = body.choices;
      }

      logger.info(`${logPrefix} Step 4b: Inserting question into database`);
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 4b: Inserting question into database\n`
        );
      }

      logger.info(`${logPrefix} Insert data prepared`, {
        insertData: {
          venue_id: insertDataBase.venue_id as string,
          question: (insertDataBase.question as string)?.substring(0, 50) + "...",
          question_type: insertDataBase.question_type as string,
          is_active: insertDataBase.is_active as boolean,
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
          hasOptions: "options" in insertData,
          hasDisplayOrder: "display_order" in insertData,
        });
        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Initial insert error: ${error.message}\n`
          );
        }
      }

      // If error is about missing column(s), retry without them
      // Check multiple possible error message patterns
      const isColumnError =
        error &&
        (error.message?.toLowerCase().includes("could not find") ||
          error.message?.toLowerCase().includes("column") ||
          error.code === "PGRST116" || // PostgREST error code for missing column
          error.code === "42703"); // PostgreSQL error code for undefined column

      if (isColumnError && error) {
        // Determine which column(s) are missing
        const errorMsg = error.message?.toLowerCase() || "";
        const isOptionsColumnError = errorMsg.includes("options");
        const isDisplayOrderColumnError = errorMsg.includes("display_order");

        if (isOptionsColumnError || isDisplayOrderColumnError) {
          const retryMsg = `${logPrefix} Column(s) not found (options: ${isOptionsColumnError}, display_order: ${isDisplayOrderColumnError}), retrying insert without missing columns`;
          logger.warn(retryMsg);
          if (typeof process !== "undefined" && process.stdout) {
            process.stdout.write(`${new Date().toISOString()} ${retryMsg}\n`);
          }

          const insertDataRetry = { ...insertData };
          if (isOptionsColumnError && "options" in insertDataRetry) {
            delete insertDataRetry.options;
          }
          if (isDisplayOrderColumnError && "display_order" in insertDataRetry) {
            delete insertDataRetry.display_order;
          }

          logger.info(`${logPrefix} Retrying insert without missing columns`);
          if (typeof process !== "undefined" && process.stdout) {
            process.stdout.write(
              `${new Date().toISOString()} ${logPrefix} Retrying insert without missing columns\n`
            );
          }

          const retryResult = await supabase
            .from("feedback_questions")
            .insert(insertDataRetry)
            .select()
            .single();

          question = retryResult.data;
          error = retryResult.error;

          if (error) {
            logger.error(
              `${logPrefix} Retry insert also failed: ${error.message || "Unknown error"}`
            );
            if (typeof process !== "undefined" && process.stdout) {
              process.stdout.write(
                `${new Date().toISOString()} ${logPrefix} Retry insert also failed: ${error.message || "Unknown error"}\n`
              );
            }
          } else {
            logger.info(`${logPrefix} Retry insert succeeded without missing columns`);
            if (typeof process !== "undefined" && process.stdout) {
              process.stdout.write(
                `${new Date().toISOString()} ${logPrefix} Retry insert succeeded without missing columns\n`
              );
            }
          }
        } else {
          // Unknown column error - try removing all optional columns
          logger.warn(
            `${logPrefix} Unknown column error, retrying with minimal required columns only`
          );
          if (typeof process !== "undefined" && process.stdout) {
            process.stdout.write(
              `${new Date().toISOString()} ${logPrefix} Unknown column error, retrying with minimal columns\n`
            );
          }

          const minimalInsertData: Record<string, unknown> = {
            venue_id: insertDataBase.venue_id as string,
            question_text: insertDataBase.question_text as string,
            question_type: insertDataBase.question_type as string,
            is_active: insertDataBase.is_active as boolean,
          };

          const retryResult = await supabase
            .from("feedback_questions")
            .insert(minimalInsertData)
            .select()
            .single();

          question = retryResult.data;
          error = retryResult.error;
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
            question_length:
              typeof insertDataBase.question === "string" ? insertDataBase.question.length : 0,
            question_type: insertDataBase.question_type,
            is_active: insertDataBase.is_active,
            display_order:
              "display_order" in insertDataBase ? insertDataBase.display_order : "not included",
            hasOptions: !!insertData.options,
          },
        });

        if (typeof process !== "undefined" && process.stdout) {
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

        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        }

        return apiErrors.database("Failed to create question - no data returned");
      }

      const successMessage = `${logPrefix} ✅ Question created successfully - ID: ${question.id}, Duration: ${Date.now() - startTime}ms`;
      logger.info(successMessage, {
        questionId: question.id,
        venueId: normalizedVenueId,
        userId: context.user?.id,
        questionText: (question.question || question.question_text || "")?.substring(0, 50) + "...",
        questionType: question.question_type,
        duration: Date.now() - startTime,
      });

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${successMessage}\n`);
      }

      // STEP 5: Transform question to match frontend expectations
      logger.info(
        `[FEEDBACK QUESTIONS POST ${requestId}] Step 5: Transforming question for frontend`
      );

      // Extract prompt from all possible column names
      const prompt =
        (question as { question?: string }).question ||
        (question as { question_text?: string }).question_text ||
        (question as { text?: string }).text ||
        (question as { prompt?: string }).prompt ||
        body.prompt || // Fallback to the original prompt from request body
        "";

      if (!prompt || prompt.trim().length === 0) {
        const errorMsg = `${logPrefix} ERROR: Question created but prompt is missing`;
        logger.error(errorMsg, {
          questionId: question.id,
          questionFields: Object.keys(question),
          bodyPrompt: body.prompt,
        });
        return apiErrors.internal("Question created but prompt is missing");
      }

      const transformedQuestion = {
        id: question.id,
        prompt: prompt.trim(), // Ensure prompt is trimmed and never empty
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

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 6: Returning success response - Question ID: ${transformedQuestion.id}\n`
        );
      }

      const response = success({ question: transformedQuestion });
      const finalSuccessMsg = `${logPrefix} ===== SUCCESS - Question created ===== ID: ${transformedQuestion.id}, Duration: ${Date.now() - startTime}ms`;
      logger.info(finalSuccessMsg, {
        questionId: transformedQuestion.id,
        duration: Date.now() - startTime,
      });

      if (typeof process !== "undefined" && process.stdout) {
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

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        if (errorStack) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Stack: ${errorStack.substring(0, 500)}\n`
          );
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
      try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) {
          logger.warn("[FEEDBACK QUESTIONS] venueId not found in query params", {
            url: req.url,
            searchParams: Object.fromEntries(searchParams.entries()),
          });
        }
        return venueId;
      } catch (error) {
        logger.error("[FEEDBACK QUESTIONS] Error extracting venueId", {
          error: error instanceof Error ? error.message : String(error),
          url: req.url,
        });
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
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
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
      if (body.prompt !== undefined) updateData.question = body.prompt; // Map 'prompt' to 'question' (actual DB column)
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
      const isColumnError =
        error &&
        ((error.message?.toLowerCase().includes("column") &&
          error.message?.toLowerCase().includes("could not find")) ||
          error.message?.toLowerCase().includes("could not find") ||
          error.code === "PGRST116" || // PostgREST error code for missing column
          error.code === "42703"); // PostgreSQL error code for undefined column

      if (isColumnError && error) {
        // Determine which column(s) are missing
        const errorMsg = error.message?.toLowerCase() || "";
        const isOptionsColumnError = errorMsg.includes("options");
        const isDisplayOrderColumnError = errorMsg.includes("display_order");

        if (isOptionsColumnError || isDisplayOrderColumnError) {
          logger.warn(
            "[FEEDBACK QUESTIONS PATCH] Column(s) not found, retrying update without missing columns",
            {
              isOptionsColumnError,
              isDisplayOrderColumnError,
            }
          );

          const updateDataRetry = { ...updateData };
          if (isOptionsColumnError && "options" in updateDataRetry) {
            delete updateDataRetry.options;
          }
          if (isDisplayOrderColumnError && "display_order" in updateDataRetry) {
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
      // Extract prompt from all possible column names
      const prompt =
        (question as { question?: string }).question ||
        (question as { question_text?: string }).question_text ||
        (question as { text?: string }).text ||
        (question as { prompt?: string }).prompt ||
        body.prompt || // Fallback to the original prompt from request body
        "";

      if (!prompt || prompt.trim().length === 0) {
        logger.error("[FEEDBACK QUESTIONS PATCH] Question updated but prompt is missing", {
          questionId: question.id,
          questionFields: Object.keys(question),
          bodyPrompt: body.prompt,
        });
        return apiErrors.internal("Question updated but prompt is missing");
      }

      const transformedQuestion = {
        id: question.id,
        prompt: prompt.trim(), // Ensure prompt is trimmed and never empty
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

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) {
          logger.warn("[FEEDBACK QUESTIONS] venueId not found in query params", {
            url: req.url,
            searchParams: Object.fromEntries(searchParams.entries()),
          });
        }
        return venueId;
      } catch (error) {
        logger.error("[FEEDBACK QUESTIONS] Error extracting venueId", {
          error: error instanceof Error ? error.message : String(error),
          url: req.url,
        });
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
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
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
      // Support both query params and body for DELETE (frontend sends in body)
      const { searchParams } = new URL(req.url);
      let deleteId = searchParams.get("id");

      // If not in query params, try to get from body
      if (!deleteId) {
        try {
          const body = await req.json().catch(() => ({}));
          deleteId = body.id;
        } catch {
          // Body parsing failed, continue with query param only
        }
      }

      const query = validateQuery(deleteQuestionSchema, {
        id: deleteId,
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

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    extractVenueId: async (req) => {
      try {
        // For DELETE requests, check both query params and body
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId");

        // If not in query params and it's a DELETE request, check body
        if (!venueId && req.method === "DELETE") {
          try {
            const clonedReq = req.clone();
            const body = await clonedReq.json().catch(() => ({}));
            venueId = body.venue_id || body.venueId || null;
            logger.debug("[FEEDBACK QUESTIONS DELETE] Extracted venueId from body", {
              venueId,
              bodyKeys: Object.keys(body),
            });
          } catch {
            // Body parsing failed, continue with query param only
            logger.debug(
              "[FEEDBACK QUESTIONS DELETE] Body parsing failed, using query params only"
            );
          }
        }

        if (!venueId) {
          logger.warn("[FEEDBACK QUESTIONS DELETE] venueId not found in query params or body", {
            url: req.url,
            searchParams: Object.fromEntries(searchParams.entries()),
            method: req.method,
          });
        }
        return venueId;
      } catch (error) {
        logger.error("[FEEDBACK QUESTIONS DELETE] Error extracting venueId", {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          url: req.url,
          method: req.method,
        });
        return null;
      }
    },
  }
);
