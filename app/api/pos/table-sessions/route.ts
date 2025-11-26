import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
      const { searchParams } = new URL(req.url);

      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json(
          { error: "venueId is required" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify resource belongs to venue (handled by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Get table status using the function
      const { data: tableStatus, error } = await supabase.rpc("get_table_status", {
        p_venue_id: venueId,
      });

      if (error) {
        logger.error("[POS TABLE SESSIONS] Error:", {
          error: error instanceof Error ? error.message : "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // STEP 7: Return response
      return NextResponse.json({ tables: tableStatus });
      
    } catch (_error) {
      // STEP 8: Consistent error handling
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[POS TABLE SESSIONS GET] Unexpected error:", {
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
    // STEP 9: Extract venueId from request (query params)
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        return searchParams.get("venue_id");
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
      const { table_id, action, server_id, guest_count, notes } = body;

      // STEP 4: Validate inputs
      if (!venueId || !table_id || !action) {
        return NextResponse.json(
          { error: "venueId, table_id, and action are required" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify resource belongs to venue (handled by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();
      let result;

      switch (action) {
        case "seat_party":
          // Create new table session
          const { data: session, error: sessionError } = await supabase
            .from("table_sessions")
            .insert({
              venue_id: venueId,
              table_id,
              server_id: server_id || null,
              guest_count: guest_count || 1,
              notes,
              status: "OCCUPIED",
            })
            .select()
            .single();

          if (sessionError) {
            logger.error("[POS TABLE SESSIONS] Error creating session:", {
              ...sessionError,
              venueId,
              userId: context.user.id,
            });
            return NextResponse.json({ error: "Failed to create table session" }, { status: 500 });
          }

          result = { session, action: "seated" };
          break;

        case "close_tab":
          // Close table session
          const { data: closedSession, error: closeError } = await supabase
            .from("table_sessions")
            .update({
              closed_at: new Date().toISOString(),
              status: "CLEANING",
            })
            .eq("venue_id", venueId)
            .eq("table_id", table_id)
            .eq("closed_at", null)
            .select()
            .single();

          if (closeError) {
            logger.error("[POS TABLE SESSIONS] Error closing session:", {
              ...closeError,
              venueId,
              userId: context.user.id,
            });
            return NextResponse.json({ error: "Failed to close table session" }, { status: 500 });
          }

          // CRITICAL: Verify all orders are PAID before completing
          const { data: ordersToComplete } = await supabase
            .from("orders")
            .select("id, payment_status")
            .eq("venue_id", venueId)
            .eq("table_id", table_id)
            .eq("is_active", true);

          const unpaidOrders = ordersToComplete?.filter(
            (order) => (order.payment_status || "").toString().toUpperCase() !== "PAID"
          ) || [];

          if (unpaidOrders.length > 0) {
            logger.warn("[POS TABLE SESSIONS] Attempted to complete unpaid orders", {
              unpaidCount: unpaidOrders.length,
              orderIds: unpaidOrders.map((o) => o.id),
              venueId,
              userId: context.user.id,
            });
            return NextResponse.json(
              {
                error: `Cannot close table: ${unpaidOrders.length} order(s) are unpaid. Please collect payment first.`,
                unpaid_order_ids: unpaidOrders.map((o) => o.id),
              },
              { status: 400 }
            );
          }

          // Mark all active orders as completed
          const { error: ordersError } = await supabase
            .from("orders")
            .update({ order_status: "COMPLETED" })
            .eq("venue_id", venueId)
            .eq("table_id", table_id)
            .eq("is_active", true);

          if (ordersError) {
            logger.error("[POS TABLE SESSIONS] Error completing orders:", {
              ...ordersError,
              venueId,
              userId: context.user.id,
            });
          }

          result = { session: closedSession, action: "closed" };
          break;

        case "mark_cleaning":
          // Mark table as cleaning
          const { data: cleaningSession, error: cleaningError } = await supabase
            .from("table_sessions")
            .update({ status: "CLEANING" })
            .eq("venue_id", venueId)
            .eq("table_id", table_id)
            .eq("closed_at", null)
            .select()
            .single();

          if (cleaningError) {
            logger.error("[POS TABLE SESSIONS] Error marking cleaning:", {
              ...cleaningError,
              venueId,
              userId: context.user.id,
            });
            return NextResponse.json({ error: "Failed to mark table as cleaning" }, { status: 500 });
          }

          result = { session: cleaningSession, action: "cleaning" };
          break;

        case "mark_free":
          // Mark table as free
          const { data: freeSession, error: freeError } = await supabase
            .from("table_sessions")
            .update({
              status: "FREE",
              closed_at: new Date().toISOString(),
            })
            .eq("venue_id", venueId)
            .eq("table_id", table_id)
            .eq("closed_at", null)
            .select()
            .single();

          if (freeError) {
            logger.error("[POS TABLE SESSIONS] Error marking free:", {
              ...freeError,
              venueId,
              userId: context.user.id,
            });
            return NextResponse.json({ error: "Failed to mark table as free" }, { status: 500 });
          }

          result = { session: freeSession, action: "free" };
          break;

        default:
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      // STEP 7: Return response
      return NextResponse.json(result);
      
    } catch (_error) {
      // STEP 8: Consistent error handling
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[POS TABLE SESSIONS POST] Unexpected error:", {
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
    // STEP 9: Extract venueId from request (body)
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        return body?.venue_id;
      } catch {
        return null;
      }
    },
  }
);
