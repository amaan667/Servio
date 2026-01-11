import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
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

  prompt: z.string().min(1).max(500), // Frontend uses 'prompt', map to 'question_text' for DB
  type: z.enum(["stars", "multiple_choice", "paragraph"]), // Frontend uses 'type', map to 'question_type' for DB

  choices: z.array(z.string()).optional(), // Frontend uses 'choices', map to 'options' for DB

const updateQuestionSchema = createQuestionSchema.partial().extend({

  venue_id: venueIdSchema.optional(), // Allow venue_id in updates

const deleteQuestionSchema = z.object({

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

      let limit = 200;
      let offset = 0;

      try {
        const pagination = validateQuery(paginationSchema, {

        limit = pagination.limit;
        offset = pagination.offset;
      } catch (error) {
        if (isZodError(error)) {
          .errors,

          // Use defaults if validation fails
        } else {

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

          }) => {
            // Try all possible column names for the question text
            const prompt = q.question_text || q.question || q.text || q.prompt || "";

            // Only include questions with valid prompts
            if (!prompt || prompt.trim().length === 0) {

              return null;
            }

            return {

              prompt: prompt.trim(), // Ensure prompt is trimmed and never empty
              type: q.question_type, // Map 'question_type' to 'type' for frontend
              choices: q.options || [], // Map 'options' to 'choices' for frontend

              sort_index: q.display_order ?? 0, // Map 'display_order' to 'sort_index' for frontend, default to 0 if missing

            };
          }
        )
        .filter((q): q is NonNullable<typeof q> => q !== null); // Remove null entries

      // STEP 5: Return success response
      return success({

        totalCount,
        activeCount,

          offset,

        },

    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {

        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) {
          ),

        }
        return venueId;
      } catch (error) {

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
    
    if (typeof process !== "undefined" && process.stdout) {
      process.stdout.write(`${new Date().toISOString()} ${logMessage}\n`);
    }

    .toISOString(),
      requestId,

    if (typeof process !== "undefined" && process.stdout) {
      process.stdout.write(
        `${new Date().toISOString()} ${logPrefix} Request started - URL: ${req.url}, Method: ${req.method}\n`
      );
    }

    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 1: Checking rate limit\n`
        );
      }

      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        const rateLimitMsg = `${logPrefix} Rate limit exceeded`;
        
        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${rateLimitMsg}\n`);
        }
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${logPrefix} Rate limit check passed\n`);
      }

      // STEP 2: Get venueId from context (already verified)
      
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 2: Getting venueId from context\n`
        );
      }

      const venueId = context.venueId;

      

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Context venueId: ${venueId || "MISSING"}, UserId: ${context.user?.id || "MISSING"}\n`
        );
      }

      if (!venueId) {
        
        return apiErrors.badRequest("venueId is required");
      }

      // Normalize venueId - database stores with venue- prefix
      // Check if it already has the prefix to avoid double-prefixing
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;
      

      // STEP 3: Validate input
      // withUnifiedAuth reconstructs the body, so we can read it normally
      
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 3: Parsing request body\n`
        );
      }

      let body;
      try {
        const rawBody = await req.json().catch((parseError) => {
          const errorMsg = `${logPrefix} Failed to parse request body: ${parseError instanceof Error ? parseError.message : String(parseError)}`;

          if (typeof process !== "undefined" && process.stdout) {
            process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
          }
          throw new Error("Invalid JSON in request body");

         ? rawBody.choices.length : 0,
          rawBodyKeys: Object.keys(rawBody || {}),

        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Raw body parsed - prompt: ${rawBody?.prompt?.substring(0, 30)}..., type: ${rawBody?.type}, venue_id: ${rawBody?.venue_id}\n`
          );
        }

        
        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Validating body against schema\n`
          );
        }

        body = await validateBody(createQuestionSchema, rawBody);
        

        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Body validation passed - prompt: ${body.prompt.substring(0, 30)}..., type: ${body.type}\n`
          );
        }
      } catch (error) {
        const errorMsg = `${logPrefix} Body validation error: ${error instanceof Error ? error.message : String(error)}`;

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
      
      const bodyVenueId = body.venue_id.startsWith("venue-")
        ? body.venue_id
        : `venue-${body.venue_id}`;
      

      if (bodyVenueId !== normalizedVenueId) {
        
        return apiErrors.forbidden("Venue ID mismatch");
      }

      // STEP 4: Business logic
      
      const supabase = createAdminClient();
      

      // Get current max display_order for this venue
      // Handle case where display_order column might not exist
      
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
          
          displayOrderColumnExists = false;
        } else {
          
        }
      } else {
        // Column exists, calculate next display order
        displayOrderColumnExists = true;
        nextDisplayOrder =
          existingQuestions?.display_order !== undefined
            ? existingQuestions.display_order + 1

      }

      

      // STEP 4b: Discover actual schema by querying an existing row
      // This will tell us what columns actually exist
      
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
        
      }

      // Determine actual column names from sample or use defaults
      const actualColumns = {

      };

      

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Schema: questionText=${actualColumns.questionText}, questionType=${actualColumns.questionType}\n`
        );
      }

      // Prepare insert data using discovered column names
      const insertDataBase: Record<string, unknown> = {

        [actualColumns.questionText]: body.prompt,
        [actualColumns.questionType]: body.type,

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

      
      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 4b: Inserting question into database\n`
        );
      }

      ?.substring(0, 50) + "...",

        },

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
            
            if (typeof process !== "undefined" && process.stdout) {
              process.stdout.write(
                `${new Date().toISOString()} ${logPrefix} Retry insert also failed: ${error.message || "Unknown error"}\n`
              );
            }
          } else {
            
            if (typeof process !== "undefined" && process.stdout) {
              process.stdout.write(
                `${new Date().toISOString()} ${logPrefix} Retry insert succeeded without missing columns\n`
              );
            }
          }
        } else {
          // Unknown column error - try removing all optional columns
          
          if (typeof process !== "undefined" && process.stdout) {
            process.stdout.write(
              `${new Date().toISOString()} ${logPrefix} Unknown column error, retrying with minimal columns\n`
            );
          }

          const minimalInsertData: Record<string, unknown> = {

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
        

        if (typeof process !== "undefined" && process.stdout) {
          process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        }

        return apiErrors.database("Failed to create question - no data returned");
      }

      const successMessage = `${logPrefix} ✅ Question created successfully - ID: ${question.id}, Duration: ${Date.now() - startTime}ms`;
      ?.substring(0, 50) + "...",

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${successMessage}\n`);
      }

      // STEP 5: Transform question to match frontend expectations
      

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

        return apiErrors.internal("Question created but prompt is missing");
      }

      const transformedQuestion = {

        prompt: prompt.trim(), // Ensure prompt is trimmed and never empty
        type: question.question_type, // Map 'question_type' to 'type'
        choices: question.options || [], // Map 'options' to 'choices'

        sort_index: (question as { display_order?: number }).display_order ?? 0, // Map 'display_order' to 'sort_index', default to 0 if missing

      };

      

      // STEP 6: Return success response
       - startTime,

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(
          `${new Date().toISOString()} ${logPrefix} Step 6: Returning success response - Question ID: ${transformedQuestion.id}\n`
        );
      }

      const response = success({ question: transformedQuestion });
      const finalSuccessMsg = `${logPrefix} ===== SUCCESS - Question created ===== ID: ${transformedQuestion.id}, Duration: ${Date.now() - startTime}ms`;
       - startTime,

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${finalSuccessMsg}\n`);
      }

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const duration = Date.now() - startTime;

      const errorMsg = `${logPrefix} ===== UNEXPECTED ERROR ===== ${errorMessage}`;
      

      if (typeof process !== "undefined" && process.stdout) {
        process.stdout.write(`${new Date().toISOString()} ${errorMsg}\n`);
        if (errorStack) {
          process.stdout.write(
            `${new Date().toISOString()} ${logPrefix} Stack: ${errorStack.substring(0, 500)}\n`
          );
        }
      }

      if (isZodError(error)) {
        .errors,

        return handleZodError(error);
      }

      
      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? { message: errorMessage, stack: errorStack } : undefined
      );
    }
  },
  {

        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) {
          ),

        }
        return venueId;
      } catch (error) {

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
           not found, retrying update without missing columns",
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
        
        return apiErrors.database(
          "Failed to update question",
          isDevelopment() ? error?.message : undefined
        );
      }

      

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

        return apiErrors.internal("Question updated but prompt is missing");
      }

      const transformedQuestion = {

        prompt: prompt.trim(), // Ensure prompt is trimmed and never empty
        type: question.question_type, // Map 'question_type' to 'type'
        choices: question.options || [], // Map 'options' to 'choices'

        sort_index: (question as { display_order?: number }).display_order ?? 0, // Map 'display_order' to 'sort_index', default to 0 if missing

      };

      // STEP 7: Return success response
      return success({ question: transformedQuestion });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {

        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) {
          ),

        }
        return venueId;
      } catch (error) {

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

      // STEP 4: Security - Verify question belongs to venue
      const supabase = createAdminClient();
      const { data: existingQuestion, error: checkError } = await supabase
        .from("feedback_questions")
        .select("venue_id")
        .eq("id", query.id)
        .eq("venue_id", normalizedVenueId)
        .single();

      if (checkError || !existingQuestion) {
        
        return apiErrors.notFound("Question not found or access denied");
      }

      // STEP 5: Business logic - Delete question
      const { error } = await supabase
        .from("feedback_questions")
        .delete()
        .eq("id", query.id)
        .eq("venue_id", normalizedVenueId);

      if (error) {
        
        return apiErrors.database(
          "Failed to delete question",
          isDevelopment() ? error.message : undefined
        );
      }

      

      // STEP 6: Return success response
      return success({ deleted: true });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {

        // For DELETE requests, check both query params and body
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId");

        // If not in query params and it's a DELETE request, check body
        if (!venueId && req.method === "DELETE") {
          try {
            const clonedReq = req.clone();
            const body = await clonedReq.json().catch(() => ({}));
            venueId = body.venue_id || body.venueId || null;

          } catch {
            // Body parsing failed, continue with query param only
            
          }
        }

        if (!venueId) {
          ),

        }
        return venueId;
      } catch (error) {

        return null;
      }
    },
  }
);
