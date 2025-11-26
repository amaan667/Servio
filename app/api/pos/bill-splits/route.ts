import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

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
      const { table_session_id, counter_session_id, splits, action } = body;

      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json(
          { error: "venue_id is required" },
          { status: 400 }
        );
      }

      if (!splits || !Array.isArray(splits)) {
        return NextResponse.json(
          { error: "splits array is required" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = createAdminClient();

    let result;

    switch (action) {
      case "create_splits":
        // Create bill splits
        const billSplits = [];

        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];

          // Create bill split record
          const { data: billSplit, error: splitError } = await supabase
            .from("bill_splits")
            .insert({
              venue_id: venueId, // Use context.venueId
              table_session_id,
              counter_session_id,
              split_number: i + 1,
              total_amount: split.total_amount,
              payment_status: "UNPAID",
            })
            .select()
            .single();

          if (splitError) {
            logger.error("[POS BILL SPLITS] Error creating split:", splitError);
            return NextResponse.json({ error: "Failed to create bill split" }, { status: 500 });
          }

          // Link orders to this split
          if (split.order_ids && split.order_ids.length > 0) {
            const orderSplitLinks = split.order_ids.map((orderId: string) => ({
              order_id: orderId,
              bill_split_id: billSplit.id,
              amount: split.total_amount / split.order_ids.length,
            }));

            const { error: linksError } = await supabase
              .from("order_bill_splits")
              .insert(orderSplitLinks);

            if (linksError) {
              logger.error("[POS BILL SPLITS] Error linking orders:", linksError);
              return NextResponse.json(
                { error: "Failed to link orders to split" },
                { status: 500 }
              );
            }
          }

          billSplits.push(billSplit);
        }

        result = { splits: billSplits, action: "created" };
        break;

      case "pay_split": {
        const { split_id, payment_method } = body;

        if (!split_id || !payment_method) {
          return NextResponse.json(
            { error: "split_id and payment_method are required" },
            { status: 400 }
          );
        }

        // Mark split as paid
        const { data: paidSplit, error: payError } = await supabase
          .from("bill_splits")
          .update({
            payment_status: "PAID",
            payment_method,
          })
          .eq("id", split_id)
          .eq("venue_id", venueId) // Security: ensure venue matches
          .select()
          .single();

        if (payError) {
          logger.error("[POS BILL SPLITS] Error paying split:", payError);
          return NextResponse.json({ error: "Failed to mark split as paid" }, { status: 500 });
        }

        result = { split: paidSplit, action: "paid" };
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

      return NextResponse.json(result);
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[POS BILL SPLITS] Unexpected error:", {
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
      const tableSessionId = searchParams.get("table_session_id");
      const counterSessionId = searchParams.get("counter_session_id");

      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = createAdminClient();

      let query = supabase
        .from("bill_splits")
        .select(
          `
          *,
          order_bill_splits (
            order_id,
            amount,
            orders (
              id,
              customer_name,
              total_amount,
              order_status
            )
          )
        `
        )
        .eq("venue_id", venueId); // Security: always filter by venueId

      if (tableSessionId) {
        query = query.eq("table_session_id", tableSessionId);
      }

      if (counterSessionId) {
        query = query.eq("counter_session_id", counterSessionId);
      }

      const { data: splits, error } = await query.order("split_number");

      if (error) {
        logger.error("[POS BILL SPLITS GET] Error fetching splits:", {
          error: error instanceof Error ? error.message : "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch bill splits",
            message: process.env.NODE_ENV === "development" ? error.message : "Database query failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({ splits });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[POS BILL SPLITS GET] Unexpected error:", {
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
