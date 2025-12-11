import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { isDevelopment } from "@/lib/env";
import { z } from "zod";
import { validateBody, validateQuery } from "@/lib/api/validation-schemas";

// Validation schemas
const billSplitItemSchema = z.object({
  total_amount: z.number().nonnegative(),
  order_ids: z.array(z.string().uuid()).optional(),
});

const createBillSplitsSchema = z.object({
  venue_id: z.string().uuid(),
  table_session_id: z.string().uuid().optional(),
  counter_session_id: z.string().uuid().optional(),
  splits: z.array(billSplitItemSchema).min(1, "At least one split required"),
  action: z.literal("create_splits"),
});

const paySplitSchema = z.object({
  venue_id: z.string().uuid(),
  split_id: z.string().uuid(),
  payment_method: z.enum(["CASH", "CARD", "STRIPE"]),
  action: z.literal("pay_split"),
});

const billSplitsActionSchema = z.discriminatedUnion("action", [
  createBillSplitsSchema,
  paySplitSchema,
]);

const getBillSplitsQuerySchema = z.object({
  table_session_id: z.string().uuid().optional(),
  counter_session_id: z.string().uuid().optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Validate input
      const body = await validateBody(billSplitsActionSchema, await req.json());

      // Verify venue_id matches context
      if (body.venue_id !== venueId) {
        return apiErrors.forbidden("Venue ID mismatch");
      }

      // STEP 4: Business logic
      const supabase = createAdminClient();
      let result;

      if (body.action === "create_splits") {
        // Create bill splits
        const billSplits = [];

        for (let i = 0; i < body.splits.length; i++) {
          const split = body.splits[i];

          // Create bill split record
          const { data: billSplit, error: splitError } = await supabase
            .from("bill_splits")
            .insert({
              venue_id: venueId,
              table_session_id: body.table_session_id || null,
              counter_session_id: body.counter_session_id || null,
              split_number: i + 1,
              total_amount: split.total_amount,
              payment_status: "UNPAID",
            })
            .select()
            .single();

          if (splitError || !billSplit) {
            logger.error("[POS BILL SPLITS] Error creating split:", {
              error: splitError,
              venueId,
              userId: context.user.id,
            });
            return apiErrors.database(
              "Failed to create bill split",
              isDevelopment() ? splitError?.message : undefined
            );
          }

          // Link orders to this split
          if (split.order_ids && Array.isArray(split.order_ids) && split.order_ids.length > 0) {
            const orderIds = split.order_ids || [];
            const orderSplitLinks = orderIds.map((orderId) => ({
              order_id: orderId,
              bill_split_id: billSplit.id,
              amount: split.total_amount / orderIds.length,
            }));

            const { error: linksError } = await supabase
              .from("order_bill_splits")
              .insert(orderSplitLinks);

            if (linksError) {
              logger.error("[POS BILL SPLITS] Error linking orders:", {
                error: linksError,
                venueId,
                userId: context.user.id,
              });
              return apiErrors.database(
                "Failed to link orders to split",
                isDevelopment() ? linksError.message : undefined
              );
            }
          }

          billSplits.push(billSplit);
        }

        result = { splits: billSplits, action: "created" };
      } else if (body.action === "pay_split") {
        // Mark split as paid
        const { data: paidSplit, error: payError } = await supabase
          .from("bill_splits")
          .update({
            payment_status: "PAID",
            payment_method: body.payment_method,
          })
          .eq("id", body.split_id)
          .eq("venue_id", venueId) // Security: ensure venue matches
          .select()
          .single();

        if (payError || !paidSplit) {
          logger.error("[POS BILL SPLITS] Error paying split:", {
            error: payError,
            splitId: body.split_id,
            venueId,
            userId: context.user.id,
          });
          return apiErrors.database(
            "Failed to mark split as paid",
            isDevelopment() ? payError?.message : undefined
          );
        }

        result = { split: paidSplit, action: "paid" };
      } else {
        return apiErrors.badRequest("Invalid action");
      }

      logger.info("[POS BILL SPLITS] Operation completed successfully", {
        action: body.action,
        venueId,
        userId: context.user.id,
      });

      // STEP 5: Return success response
      return success(result);
    } catch (error) {
      logger.error("[POS BILL SPLITS] Unexpected error:", {
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
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
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
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Validate query parameters
      const { searchParams } = new URL(req.url);
      const query = validateQuery(getBillSplitsQuerySchema, {
        table_session_id: searchParams.get("table_session_id") || undefined,
        counter_session_id: searchParams.get("counter_session_id") || undefined,
      });

      // STEP 4: Business logic
      const supabase = createAdminClient();

      let dbQuery = supabase
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

      if (query.table_session_id) {
        dbQuery = dbQuery.eq("table_session_id", query.table_session_id);
      }

      if (query.counter_session_id) {
        dbQuery = dbQuery.eq("counter_session_id", query.counter_session_id);
      }

      const { data: splits, error } = await dbQuery.order("split_number");

      if (error) {
        logger.error("[POS BILL SPLITS GET] Error fetching splits:", {
          error: error.message,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch bill splits",
          isDevelopment() ? error.message : undefined
        );
      }

      // STEP 5: Return success response
      return success({ splits: splits || [] });
    } catch (error) {
      logger.error("[POS BILL SPLITS GET] Unexpected error:", {
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
