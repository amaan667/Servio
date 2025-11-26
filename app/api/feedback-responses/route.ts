import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// POST - Submit feedback responses
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
      const body = await req.json();
      const { order_id, answers } = body;

      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
      }

      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        return NextResponse.json({ 
          error: 'answers array required' 
        }, { status: 400 });
      }

      // Validate answers structure
      for (const answer of answers) {
        if (!answer.question_id || !answer.type) {
          return NextResponse.json({ 
            error: 'Each answer must have question_id and type' 
          }, { status: 400 });
        }

        // Validate answer content based on type
        switch (answer.type) {
          case 'stars':
            if (typeof answer.answer_stars !== 'number' || answer.answer_stars < 1 || answer.answer_stars > 5) {
              return NextResponse.json({ 
                error: 'Stars answers must be 1-5' 
              }, { status: 400 });
            }
            break;
          case 'multiple_choice':
            if (!answer.answer_choice || typeof answer.answer_choice !== 'string') {
              return NextResponse.json({ 
                error: 'Multiple choice answers must have answer_choice' 
              }, { status: 400 });
            }
            break;
          case 'paragraph':
            if (!answer.answer_text || typeof answer.answer_text !== 'string') {
              return NextResponse.json({ 
                error: 'Paragraph answers must have answer_text' 
              }, { status: 400 });
            }
            if (answer.answer_text.length > 600) {
              return NextResponse.json({ 
                error: 'Paragraph answers must be 600 characters or less' 
              }, { status: 400 });
            }
            break;
          default:
            return NextResponse.json({ 
              error: `Invalid answer type: ${answer.type}` 
            }, { status: 400 });
        }
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)
      // Verify order belongs to venue if order_id provided
      if (order_id) {
        const supabase = await createClient();
        const { data: order } = await supabase
          .from("orders")
          .select("venue_id")
          .eq("id", order_id)
          .eq("venue_id", venueId)
          .single();

        if (!order) {
          return NextResponse.json(
            { error: "Order not found or access denied" },
            { status: 404 }
          );
        }
      }

      // STEP 6: Business logic
      const supabase = await createClient();

      // Insert feedback responses
      const responsesToInsert = answers.map((answer: {
        question_id: string;
        type: string;
        answer_stars?: number;
        answer_choice?: string;
        answer_text?: string;
      }) => ({
        venue_id: venueId,
        question_id: answer.question_id,
        order_id: order_id || null,
        answer_type: answer.type,
        answer_stars: answer.answer_stars || null,
        answer_choice: answer.answer_choice || null,
        answer_text: answer.answer_text || null,
        created_at: new Date().toISOString(),
      }));

      const { data: insertedResponses, error: insertError } = await supabase
        .from('feedback_responses')
        .insert(responsesToInsert)
        .select();

      if (insertError) {
        logger.error('[FEEDBACK RESPONSES] Error inserting responses:', {
          error: insertError instanceof Error ? insertError.message : 'Unknown error',
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: 'Failed to save feedback responses',
            message: process.env.NODE_ENV === "development" ? insertError.message : "Database insert failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        responses: insertedResponses,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error('[FEEDBACK RESPONSES] Unexpected error:', {
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
