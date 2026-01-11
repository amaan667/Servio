import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const tableTransferSchema = z.object({
  action: z.enum(["transfer_orders", "merge_tables", "split_table"]),

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(tableTransferSchema, await req.json());
      const venue_id = context.venueId || body.venue_id;

      if (!venue_id || !body.action || !body.source_table_id || !body.target_table_id) {
        return apiErrors.badRequest(
          "venue_id, action, source_table_id, and target_table_id are required"
        );
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
            
            return apiErrors.database(
              "Failed to transfer orders",
              isDevelopment() ? transferError.message : undefined
            );
          }

          result = {

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

              .eq("venue_id", venue_id)
              .eq("table_id", body.source_table_id)
              .eq("closed_at", null);

            if (sessionError) {
              
            }
          }

          result = {

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
            
            return apiErrors.database(
              "Failed to split orders",
              isDevelopment() ? splitError.message : undefined
            );
          }

          result = {

          };
          break;

      }

      

      // STEP 4: Return success response
      return success(result);
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
    }
  },
  {
    // Extract venueId from body

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
