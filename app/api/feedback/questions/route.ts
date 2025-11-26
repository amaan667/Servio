import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// GET - List questions for venue
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json({ error: "venueId required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
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
        return NextResponse.json(
          {
            error: "Failed to fetch questions",
            message: process.env.NODE_ENV === "development" ? error.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // Calculate total count (all questions) and active count
      const totalCount = questions?.length || 0;
      const activeCount = questions?.filter((q) => q.is_active).length || 0;

      // STEP 7: Return success response
      return NextResponse.json({
        questions: questions || [],
        totalCount: totalCount,
        activeCount: activeCount,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[FEEDBACK QUESTIONS GET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from query params
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        return searchParams.get("venueId") || searchParams.get("venue_id");
      } catch {
        return null;
      }
    },
  }
);

// POST - Create new question
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        logger.error("[FEEDBACK QUESTIONS POST] JSON parse error:", { error: parseError });
        return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
      }

      const { prompt, type, choices, is_active = true } = body;

      // STEP 4: Validate inputs
      if (!venueId) {
        logger.error("[FEEDBACK QUESTIONS POST] Missing venue_id in request:", { body });
        return NextResponse.json({ error: "venueId required" }, { status: 400 });
      }
      if (!prompt || !type) {
        logger.error("[FEEDBACK QUESTIONS POST] Missing prompt or type:", { prompt: !!prompt, type: !!type });
        return NextResponse.json({ error: "prompt and type required" }, { status: 400 });
      }

      if (prompt.length < 4 || prompt.length > 160) {
        return NextResponse.json({ error: "Prompt must be 4-160 characters" }, { status: 400 });
      }

      if (!["stars", "multiple_choice", "paragraph"].includes(type)) {
        return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
      }

      if (type === "multiple_choice") {
        if (!choices || !Array.isArray(choices) || choices.length < 2 || choices.length > 6) {
          return NextResponse.json(
            { error: "Multiple choice questions require 2-6 choices" },
            { status: 400 }
          );
        }

        for (const choice of choices) {
          if (!choice || typeof choice !== "string" || choice.length === 0 || choice.length > 40) {
            return NextResponse.json(
              { error: "Each choice must be 1-40 characters" },
              { status: 400 }
            );
          }
        }
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Get max sort_index for this venue
      const { data: maxSort, error: maxSortError } = await supabase
        .from("feedback_questions")
        .select("sort_index")
        .eq("venue_id", venueId)
        .order("sort_index", { ascending: false })
        .limit(1)
        .single();

      if (maxSortError && maxSortError.message.includes("sort_index")) {
        logger.error("[FEEDBACK QUESTIONS POST] Database schema error - sort_index column missing");
        return NextResponse.json(
          {
            error:
              "Database schema not set up. Please contact support to apply the feedback questions schema.",
          },
          { status: 500 }
        );
      }

      const sort_index = (maxSort?.sort_index || 0) + 1;

      // Create question
      const questionData = {
        venue_id: venueId,
        prompt: prompt.trim(),
        type,
        choices: type === "multiple_choice" ? choices : null,
        is_active,
        sort_index,
      };

      const { data: question, error } = await supabase
        .from("feedback_questions")
        .insert(questionData)
        .select()
        .single();

      if (error) {
        logger.error("[FEEDBACK QUESTIONS POST] Error creating question:", {
          error: error.message,
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to create question",
            message: process.env.NODE_ENV === "development" ? error.message : "Database insert failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({ question });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[FEEDBACK QUESTIONS POST] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venue_id || body?.venueId || null;
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
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const { id, prompt, type, choices, is_active, sort_index } = await req.json();

      // STEP 4: Validate inputs
      if (!id || !venueId) {
        return NextResponse.json({ error: "id and venue_id required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)
      // Verify question belongs to venue
      const supabase = await createClient();
      const { data: question } = await supabase
        .from("feedback_questions")
        .select("venue_id")
        .eq("id", id)
        .eq("venue_id", venueId)
        .single();

      if (!question) {
        return NextResponse.json(
          { error: "Question not found or access denied" },
          { status: 404 }
        );
      }

      // STEP 6: Business logic
      const updateData: Record<string, unknown> = {};

      if (prompt !== undefined) {
        if (prompt.length < 4 || prompt.length > 160) {
          return NextResponse.json({ error: "Prompt must be 4-160 characters" }, { status: 400 });
        }
        updateData.prompt = prompt.trim();
      }

      if (type !== undefined) {
        if (!["stars", "multiple_choice", "paragraph"].includes(type)) {
          return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
        }
        updateData.type = type;
        updateData.choices = type === "multiple_choice" ? choices : null;
      }

      if (choices !== undefined && type === "multiple_choice") {
        if (!Array.isArray(choices) || choices.length < 2 || choices.length > 6) {
          return NextResponse.json(
            { error: "Multiple choice questions require 2-6 choices" },
            { status: 400 }
          );
        }

        for (const choice of choices) {
          if (!choice || typeof choice !== "string" || choice.length === 0 || choice.length > 40) {
            return NextResponse.json(
              { error: "Each choice must be 1-40 characters" },
              { status: 400 }
            );
          }
        }
        updateData.choices = choices;
      }

      if (is_active !== undefined) {
        updateData.is_active = is_active;
      }

      if (sort_index !== undefined) {
        updateData.sort_index = sort_index;
      }

      const { data: updatedQuestion, error } = await supabase
        .from("feedback_questions")
        .update(updateData)
        .eq("id", id)
        .eq("venue_id", venueId) // Security: ensure venue matches
        .select()
        .single();

      if (error) {
        logger.error("[FEEDBACK QUESTIONS PATCH] Error updating question:", {
          error: error.message,
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to update question",
            message: process.env.NODE_ENV === "development" ? error.message : "Database update failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({ question: updatedQuestion });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[FEEDBACK QUESTIONS PATCH] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venue_id || body?.venueId || null;
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
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const { id } = await req.json();

      // STEP 4: Validate inputs
      if (!id || !venueId) {
        return NextResponse.json({ error: "id and venue_id required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)
      // Verify question belongs to venue
      const supabase = await createClient();
      const { data: question } = await supabase
        .from("feedback_questions")
        .select("venue_id")
        .eq("id", id)
        .eq("venue_id", venueId)
        .single();

      if (!question) {
        return NextResponse.json(
          { error: "Question not found or access denied" },
          { status: 404 }
        );
      }

      // STEP 6: Business logic
      const { error } = await supabase
        .from("feedback_questions")
        .delete()
        .eq("id", id)
        .eq("venue_id", venueId); // Security: ensure venue matches

      if (error) {
        logger.error("[FEEDBACK QUESTIONS DELETE] Error deleting question:", {
          error: error.message,
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to delete question",
            message: process.env.NODE_ENV === "development" ? error.message : "Database delete failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({ success: true });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[FEEDBACK QUESTIONS DELETE] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);
