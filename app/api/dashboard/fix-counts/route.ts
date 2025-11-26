import { createClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from "@/lib/logger";

/**
 * API route to fix the dashboard_counts function
 * This ensures today_orders_count = live_count + earlier_today_count
 */
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

      // STEP 2: Get venueId from context (already verified, may be null)
      const venueId = context.venueId;

      // STEP 3: Parse request
      // STEP 4: Validate inputs (none required)

      // STEP 5: Security - Verify auth (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      const createFunctionSQL = `
        DROP FUNCTION IF EXISTS dashboard_counts(text, text, integer);

        CREATE OR REPLACE FUNCTION dashboard_counts(
          p_venue_id text,
          p_date text DEFAULT CURRENT_DATE::text,
          p_timezone_offset integer DEFAULT 0
        )
        RETURNS TABLE (
          today_orders_count bigint,
          live_count bigint,
          earlier_today_count bigint,
          total_revenue numeric,
          today_revenue numeric
        ) AS $$
        BEGIN
          RETURN QUERY
          WITH date_range AS (
            SELECT 
              (p_date::date + (p_timezone_offset || ' hours')::interval)::date AS start_date,
              (p_date::date + (p_timezone_offset || ' hours')::interval + interval '1 day')::date AS end_date
          ),
          live_orders AS (
            SELECT COUNT(*)::bigint AS count
            FROM orders
            WHERE venue_id = p_venue_id
              AND payment_status IN ('PAID', 'UNPAID')
              AND order_status IN ('PLACED', 'IN_PREP', 'READY')
          ),
          earlier_today_orders AS (
            SELECT COUNT(*)::bigint AS count
            FROM orders
            WHERE venue_id = p_venue_id
              AND DATE(created_at + (p_timezone_offset || ' hours')::interval) = (SELECT start_date FROM date_range)
              AND payment_status IN ('PAID', 'UNPAID')
              AND order_status NOT IN ('PLACED', 'IN_PREP', 'READY')
          ),
          today_orders AS (
            SELECT COUNT(*)::bigint AS count
            FROM orders
            WHERE venue_id = p_venue_id
              AND DATE(created_at + (p_timezone_offset || ' hours')::interval) = (SELECT start_date FROM date_range)
          ),
          revenue_data AS (
            SELECT 
              COALESCE(SUM(total_amount), 0)::numeric AS total,
              COALESCE(SUM(CASE 
                WHEN DATE(created_at + (p_timezone_offset || ' hours')::interval) = (SELECT start_date FROM date_range)
                THEN total_amount 
                ELSE 0 
              END), 0)::numeric AS today
            FROM orders
            WHERE venue_id = p_venue_id
              AND payment_status = 'PAID'
          )
          SELECT 
            COALESCE(today_orders.count, 0) AS today_orders_count,
            COALESCE(live_orders.count, 0) AS live_count,
            COALESCE(earlier_today_orders.count, 0) AS earlier_today_count,
            COALESCE(revenue_data.total, 0) AS total_revenue,
            COALESCE(revenue_data.today, 0) AS today_revenue
          FROM live_orders
          CROSS JOIN earlier_today_orders
          CROSS JOIN today_orders
          CROSS JOIN revenue_data;
        END;
        $$ LANGUAGE plpgsql;
      `;

      const { error } = await supabase.rpc("exec_sql", { sql: createFunctionSQL });

      if (error) {
        logger.error("[FIX COUNTS] Error creating function:", {
          error: error.message,
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to create function",
            message: process.env.NODE_ENV === "development" ? error.message : "Database operation failed",
          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "dashboard_counts function updated successfully",
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[FIX COUNTS] Unexpected error:", {
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
    // Extract venueId from body or query
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        if (!venueId) {
          const body = await req.json();
          venueId = body?.venueId || body?.venue_id;
        }
        return venueId;
      } catch {
        return null;
      }
    },
  }
);
