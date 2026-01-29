import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const tableTransferSchema = z.object({
  action: z.enum(["transfer_orders", "merge_tables", "split_table"]),
  source_table_id: z.string().uuid("Invalid source table ID"),
  target_table_id: z.string().uuid("Invalid target table ID"),
  order_ids: z.array(z.string().uuid()).optional(),
  merge_sessions: z.boolean().default(false),
  venue_id: z.string().uuid().optional(),
});

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body } = context;
    const venue_id = context.venueId || body.venue_id;

    if (!venue_id || !body.action || !body.source_table_id || !body.target_table_id) {
      return apiErrors.badRequest(
        "venue_id, action, source_table_id, and target_table_id are required"
      );
    }

    // Business logic
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
          return apiErrors.database("Failed to transfer orders");
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
          return apiErrors.database("Failed to fetch source orders");
        }

        if (sourceOrders && sourceOrders.length > 0) {
          const orderIds = sourceOrders.map((order: { id: string }) => order.id);

          const { error: mergeError } = await supabase
            .from("orders")
            .update({ table_id: body.target_table_id })
            .in("id", orderIds)
            .eq("venue_id", venue_id);

          if (mergeError) {
            return apiErrors.database("Failed to merge orders");
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
            /* Condition handled */
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
          return apiErrors.database("Failed to split orders");
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

    return success(result);
  },
  {
    schema: tableTransferSchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const body = await req
          .clone()
          .json()
          .catch(() => ({}));
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
