import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';

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
      const { searchParams } = new URL(req.url);
      const tableNumber = searchParams.get("tableNumber");

      // STEP 4: Validate inputs
      if (!venueId || !tableNumber) {
        return NextResponse.json(
          {
            ok: false,
            error: "venueId and tableNumber are required",
          },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      try {
        // Check for existing group session for this table
        const { data: existingSession, error } = await supabase
          .from("table_group_sessions")
          .select("*")
          .eq("venue_id", venueId)
          .eq("table_number", parseInt(tableNumber))
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          if (error.message.includes("does not exist")) {
            return NextResponse.json({
              ok: true,
              groupSessionId: null,
              message: "Table not created yet - using fallback mode",
            });
          }
          logger.error("[GROUP SESSION GET] Error fetching group session:", {
            error: error instanceof Error ? error.message : "Unknown error",
            venueId,
            userId: context.user.id,
          });
          return NextResponse.json(
            {
              ok: false,
              error: `Failed to fetch group session: ${error.message}`,
            },
            { status: 500 }
          );
        }

        if (existingSession) {
          return NextResponse.json({
            ok: true,
            groupSessionId: existingSession.id,
            totalGroupSize: existingSession.total_group_size,
            currentGroupSize: existingSession.current_group_size,
            session: existingSession,
          });
        }

        return NextResponse.json({
          ok: true,
          groupSessionId: null,
        });
      } catch {
        return NextResponse.json({
          ok: true,
          groupSessionId: null,
          message: "Table not available - using fallback mode",
        });
      }
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[GROUP SESSION GET] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            ok: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
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
      const { tableNumber, groupSize } = body;

      // STEP 4: Validate inputs
      if (!venueId || !tableNumber || !groupSize) {
        return NextResponse.json(
          {
            ok: false,
            error: "venueId, tableNumber, and groupSize are required",
          },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      try {
        // Check for existing group session for this table
        const { data: existingSession, error: fetchError } = await supabase
          .from("table_group_sessions")
          .select("*")
          .eq("venue_id", venueId)
          .eq("table_number", parseInt(tableNumber))
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) {
          if (fetchError.message.includes("does not exist")) {
            return NextResponse.json({
              ok: true,
              groupSessionId: `fallback_${venueId}_${tableNumber}`,
              totalGroupSize: groupSize,
              currentGroupSize: groupSize,
              message: "Table not created yet - using fallback mode",
            });
          }
          logger.error("[GROUP SESSION POST] Error fetching existing session:", {
            error: fetchError,
            venueId,
            userId: context.user.id,
          });
          return NextResponse.json(
            {
              ok: false,
              error: `Failed to fetch existing session: ${fetchError.message}`,
            },
            { status: 500 }
          );
        }

        if (existingSession) {
          // Update existing session with new group size
          const newTotalGroupSize = Math.max(existingSession.total_group_size, groupSize);
          const newCurrentGroupSize = existingSession.current_group_size + groupSize;

          const { data: updatedSession, error: updateError } = await supabase
            .from("table_group_sessions")
            .update({
              total_group_size: newTotalGroupSize,
              current_group_size: newCurrentGroupSize,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSession.id)
            .select()
            .single();

          if (updateError) {
            logger.error("[GROUP SESSION POST] Error updating group session:", {
              error: updateError,
              venueId,
              userId: context.user.id,
            });
            return NextResponse.json(
              {
                ok: false,
                error: `Failed to update group session: ${updateError.message}`,
              },
              { status: 500 }
            );
          }

          // Update table seat count to match new total group size
          await supabase
            .from("tables")
            .update({
              seat_count: newTotalGroupSize,
              updated_at: new Date().toISOString(),
            })
            .eq("venue_id", venueId)
            .eq("label", tableNumber.toString());

          return NextResponse.json({
            ok: true,
            groupSessionId: updatedSession.id,
            totalGroupSize: updatedSession.total_group_size,
            currentGroupSize: updatedSession.current_group_size,
            message: "Joined existing group session",
          });
        } else {
          // Create new group session
          const { data: newSession, error: createError } = await supabase
            .from("table_group_sessions")
            .insert({
              venue_id: venueId,
              table_number: parseInt(tableNumber),
              total_group_size: groupSize,
              current_group_size: groupSize,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError) {
            logger.error("[GROUP SESSION POST] Error creating group session:", {
              error: createError,
              venueId,
              userId: context.user.id,
            });
            return NextResponse.json(
              {
                ok: false,
                error: `Failed to create group session: ${createError.message}`,
              },
              { status: 500 }
            );
          }

          // Update table seat count to match group size (if table exists)
          await supabase
            .from("tables")
            .update({
              seat_count: groupSize,
              updated_at: new Date().toISOString(),
            })
            .eq("venue_id", venueId)
            .eq("label", tableNumber.toString());

          return NextResponse.json({
            ok: true,
            groupSessionId: newSession.id,
            totalGroupSize: newSession.total_group_size,
            currentGroupSize: newSession.current_group_size,
            message: "Created new group session",
          });
        }
      } catch {
        return NextResponse.json({
          ok: true,
          groupSessionId: `fallback_${venueId}_${tableNumber}`,
          totalGroupSize: groupSize,
          currentGroupSize: groupSize,
          message: "Table not available - using fallback mode",
        });
      }
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[GROUP SESSION POST] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            ok: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body or query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          const body = await req.json();
          venueId = body?.venue_id || body?.venueId;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);
