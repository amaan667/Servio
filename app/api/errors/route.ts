import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface ErrorData {
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  message?: {
    text: string;
    level: string;
  };
  context: {
    userId?: string;
    venueId?: string;
    userRole?: string;
    url: string;
    timestamp: number;
    userAgent: string;
    sessionId: string;
    customData?: Record<string, unknown>;
  };
}

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

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      const data: ErrorData = await req.json();

      // STEP 4: Validate inputs
      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // Log error/message
      if (data.error) {
        logger.error("[ERROR TRACKING] Error captured:", {
          name: data.error.name,
          message: data.error.message,
          stack: data.error.stack,
          url: data.context.url,
          userId: data.context.userId || context.user.id,
          venueId: data.context.venueId || context.venueId,
          userRole: data.context.userRole,
          sessionId: data.context.sessionId,
          timestamp: new Date(data.context.timestamp).toISOString(),
        });
      } else if (data.message) {
        logger.info(`[ERROR TRACKING] ${data.message.level.toUpperCase()}: ${data.message.text}`, {
          url: data.context.url,
          userId: data.context.userId || context.user.id,
          venueId: data.context.venueId || context.venueId,
          userRole: data.context.userRole,
          sessionId: data.context.sessionId,
          timestamp: new Date(data.context.timestamp).toISOString(),
        });
      }

      // Store in database or send to external service
      // For now, we'll just log it
      // In production, you might want to store this in a database
      // or send it to a service like Sentry, LogRocket, etc.

      // Example: Store in Supabase
      // const supabase = createServerSupabase();
      // await supabase.from('error_logs').insert({
      //   error_name: data.error?.name,
      //   error_message: data.error?.message,
      //   error_stack: data.error?.stack,
      //   message_text: data.message?.text,
      //   message_level: data.message?.level,
      //   url: data.context.url,
      //   user_id: data.context.userId,
      //   venue_id: data.context.venueId,
      //   user_role: data.context.userRole,
      //   session_id: data.context.sessionId,
      //   user_agent: data.context.userAgent,
      //   custom_data: data.context.customData,
      //   created_at: new Date().toISOString(),
      // });

      // STEP 7: Return success response
      return NextResponse.json({ success: true });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[ERROR TRACKING] Failed to process error:", {
        error: errorMessage,
        stack: errorStack,
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
          error: "Failed to process error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // System route - no venue required (errors can come from anywhere)
    extractVenueId: async () => null,
  }
);

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

      // STEP 2: Get user from context (already verified)
      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // STEP 7: Return success response
      return NextResponse.json({
        message: "Error tracking endpoint",
        status: "active",
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[ERROR TRACKING GET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
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
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
