import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const tableTransferSchema = z.object({
  action: z.enum(["transfer_orders", "merge_tables", "split_table"]),
  source_table_id: z.string().uuid("Invalid source table ID"),
  target_table_id: z.string().uuid("Invalid target table ID"),
  order_ids: z.array(z.string().uuid()).optional(),
  merge_sessions: z.boolean().default(false),
  venue_id: z.string().uuid().optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Validate input
      const body = await validateBody(tableTransferSchema, await req.json());
      const venue_id = context.venueId || body.venue_id;

      if (!venue_id || !body.action || !body.source_table_id || !body.target_table_id) {
        return apiErrors.badRequest("venue_id, action, source_table_id, and target_table_id are required");
      }

      // STEP 3: Business logic
      const supabase = createAdminClient();
      let result;

      switch (body.action) {
        case "transfer_orders":
          // Transfer specific orders from source to target table
          if (!body.order_ids || !Array.isArray(body.order_ids) || body.order_ids.length === 0) {
            return apiErrors.badRequest("order_ids array is required for transfer");
          }

          const { error: transferError } = await supabase
            .from("orders")
            .update({ table_id: body.target_table_id })
            .in("id", body.order_ids)
            .eq("venue_id", venue_id)
            .eq("table_id", body.source_table_id);

          if (transferError) {
            logger.error("[POS TABLE TRANSFER] Error transferring orders:", {
              error: transferError.message,
              venueId: venue_id,
              userId: context.user.id,
            });
            return apiErrors.database(
              "Failed to transfer orders",
              isDevelopment() ? transferError.message : undefined
            );
          }

          result = {
            action: "transferred",
            transferred_orders: body.order_ids.length,
            from_table: body.source_table_id,
            to_table: body.target_table_id,
          };
          break;

        case "merge_tables":
          // Merge all orders from source table to target table
          const { data: sourceOrders, error: sourceError } = await supabase
            .from("orders")
            .select("id")
            .eq("venue_id", venue_id)
            .eq("table_id", body.source_table_id)
            .eq("is_active", true);

          if (sourceError) {
            logger.error("[POS TABLE TRANSFER] Error fetching source orders:", {
              error: sourceError.message,
              venueId: venue_id,
              userId: context.user.id,
            });
            return apiErrors.database(
              "Failed to fetch source orders",
              isDevelopment() ? sourceError.message : undefined
            );
          }

          if (sourceOrders && sourceOrders.length > 0) {
            const orderIds = sourceOrders.map((order: { id: string }) => order.id);

            const { error: mergeError } = await supabase
              .from("orders")
              .update({ table_id: body.target_table_id })
              .in("id", orderIds)
              .eq("venue_id", venue_id);

            if (mergeError) {
              logger.error("[POS TABLE TRANSFER] Error merging orders:", {
                error: mergeError.message,
                venueId: venue_id,
                userId: context.user.id,
              });
              return apiErrors.database(
                "Failed to merge orders",
                isDevelopment() ? mergeError.message : undefined
              );
            }
          }

          // Merge table sessions if requested
          if (body.merge_sessions) {
            const { error: sessionError } = await supabase
              .from("table_sessions")
              .update({
                closed_at: new Date().toISOString(),
                status: "CLOSED",
              })
              .eq("venue_id", venue_id)
              .eq("table_id", body.source_table_id)
              .eq("closed_at", null);

            if (sessionError) {
              logger.error("[POS TABLE TRANSFER] Error closing source session:", {
                error: sessionError.message,
                venueId: venue_id,
                userId: context.user.id,
              });
            }
          }

          result = {
            action: "merged",
            merged_orders: sourceOrders?.length || 0,
            from_table: body.source_table_id,
            to_table: body.target_table_id,
          };
          break;

        case "split_table":
          // Split orders between two tables
          if (!body.order_ids || !Array.isArray(body.order_ids) || body.order_ids.length === 0) {
            return apiErrors.badRequest("order_ids array is required for split");
          }

          // Move specified orders to target table
          const { error: splitError } = await supabase
            .from("orders")
            .update({ table_id: body.target_table_id })
            .in("id", body.order_ids)
            .eq("venue_id", venue_id)
            .eq("table_id", body.source_table_id);

          if (splitError) {
            logger.error("[POS TABLE TRANSFER] Error splitting orders:", {
              error: splitError.message,
              venueId: venue_id,
              userId: context.user.id,
            });
            return apiErrors.database(
              "Failed to split orders",
              isDevelopment() ? splitError.message : undefined
            );
          }

          result = {
            action: "split",
            split_orders: body.order_ids.length,
            remaining_at_source: body.source_table_id,
            moved_to_target: body.target_table_id,
          };
          break;

        default:
          return apiErrors.badRequest("Invalid action");
      }

      logger.info("[POS TABLE TRANSFER] Table transfer completed successfully", {
        action: body.action,
        venueId: venue_id,
        sourceTable: body.source_table_id,
        targetTable: body.target_table_id,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success(result);
    } catch (error) {
      logger.error("[POS TABLE TRANSFER] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (body as { venue_id?: string; venueId?: string })?.venue_id || 
               (body as { venue_id?: string; venueId?: string })?.venueId || 
               null;
      } catch {
        return null;
      }
    },
  }
);
