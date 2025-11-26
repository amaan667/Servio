import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
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
        return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createServerSupabase();

      // Get counter status using the function
      const { data: counterStatus, error } = await supabase.rpc("get_counter_status", {
        p_venue_id: venueId,
      });

      if (error) {
        logger.error("[POS COUNTER SESSIONS GET] Error:", {
          error: error instanceof Error ? error.message : "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch counter status",
            message: process.env.NODE_ENV === "development" ? error.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({ counters: counterStatus });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[POS COUNTER SESSIONS GET] Unexpected error:", {
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
        return searchParams.get("venue_id") || searchParams.get("venueId");
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
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const body = await req.json();
      const { counter_id, action, server_id, notes } = body;

      // STEP 4: Validate inputs
      if (!venueId || !counter_id || !action) {
        return NextResponse.json(
          { error: "venue_id, counter_id, and action are required" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createServerSupabase();

    let result;

    switch (action) {
      case "open_session":
        // Create new counter session
        const { data: session, error: sessionError } = await supabase
          .from("counter_sessions")
          .insert({
            venue_id: venueId, // Use context.venueId
            counter_id,
            server_id: server_id || null,
            notes,
            status: "ACTIVE",
          })
          .select()
          .single();

        if (sessionError) {
          logger.error("[POS COUNTER SESSIONS] Error creating session:", sessionError);
          return NextResponse.json({ error: "Failed to create counter session" }, { status: 500 });
        }

        result = { session, action: "opened" };
        break;

      case "close_session":
        // Close counter session
        const { data: closedSession, error: closeError } = await supabase
          .from("counter_sessions")
          .update({
            closed_at: new Date().toISOString(),
            status: "CLOSED",
          })
          .eq("venue_id", venueId) // Security: ensure venue matches
          .eq("counter_id", counter_id)
          .eq("closed_at", null)
          .select()
          .single();

        if (closeError) {
          logger.error("[POS COUNTER SESSIONS] Error closing session:", closeError);
          return NextResponse.json({ error: "Failed to close counter session" }, { status: 500 });
        }

        // Mark all active orders as completed
        const { data: counter } = await supabase
          .from("counters")
          .select("label")
          .eq("id", counter_id)
          .single();

        if (counter) {
          // CRITICAL: Verify all orders are PAID before completing
          const { data: ordersToComplete } = await supabase
            .from("orders")
            .select("id, payment_status")
            .eq("venue_id", venueId) // Security: ensure venue matches
            .eq("table_number", counter.label)
            .eq("source", "counter")
            .eq("is_active", true);

          const unpaidOrders = ordersToComplete?.filter(
            (order) => (order.payment_status || "").toString().toUpperCase() !== "PAID"
          ) || [];

          if (unpaidOrders.length > 0) {
            logger.warn("[POS COUNTER SESSIONS] Attempted to complete unpaid orders", {
              unpaidCount: unpaidOrders.length,
              orderIds: unpaidOrders.map((o) => o.id),
            });
            return NextResponse.json(
              {
                error: `Cannot close counter: ${unpaidOrders.length} order(s) are unpaid. Please collect payment first.`,
                unpaid_order_ids: unpaidOrders.map((o) => o.id),
              },
              { status: 400 }
            );
          }

          const { error: ordersError } = await supabase
            .from("orders")
            .update({ order_status: "COMPLETED" })
            .eq("venue_id", venueId) // Security: ensure venue matches
            .eq("table_number", counter.label)
            .eq("source", "counter")
            .eq("is_active", true);

          if (ordersError) {
            logger.error("[POS COUNTER SESSIONS] Error completing orders:", ordersError);
          }
        }

        result = { session: closedSession, action: "closed" };
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

      return NextResponse.json(result);
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[POS COUNTER SESSIONS POST] Unexpected error:", {
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
