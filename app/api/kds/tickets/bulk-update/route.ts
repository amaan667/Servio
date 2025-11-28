import { NextRequest } from "next/server";
import { createClient } from '@/lib/supabase';
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

export const runtime = "nodejs";

const bulkUpdateTicketsSchema = z.object({
  ticket_ids: z.array(z.string().uuid()).min(1, "At least one ticket ID is required"),
  status: z.enum(["ready", "preparing", "bumped", "served", "cancelled"]),
  order_id: z.string().uuid().optional(),
});

// PATCH - Bulk update multiple tickets (e.g., bump all ready tickets for an order)
export const PATCH = withUnifiedAuth(
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
      const body = await validateBody(bulkUpdateTicketsSchema, await req.json());
      const { ticket_ids, status, order_id: orderId } = body;

      // STEP 3: Get venueId from context
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 4: Business logic - Update tickets
      const supabase = await createClient();
      const now = new Date().toISOString();

      const { data: tickets, error: updateError } = await supabase
        .from("kds_tickets")
        .update({
          status,
          updated_at: now,
        })
        .in("id", ticket_ids)
        .eq("venue_id", venueId)
        .select();

      if (updateError) {
        logger.error("[KDS BULK UPDATE] Error updating tickets:", {
          error: updateError.message,
          ticket_ids,
          status,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to update tickets",
          isDevelopment() ? updateError.message : undefined
        );
      }

      // STEP 5: If bumping tickets, check if ALL tickets for this order are now bumped
      if (status === "bumped" && orderId) {
        // Check if all tickets for this order are bumped
        const { data: allOrderTickets } = await supabase
          .from("kds_tickets")
          .select("id, status")
          .eq("order_id", orderId)
          .eq("venue_id", venueId);

        const allBumped = allOrderTickets?.every((t) => t.status === "bumped") || false;

        logger.debug("[KDS BULK UPDATE] Checking if all tickets bumped", {
          orderId,
          totalTickets: allOrderTickets?.length,
          bumpedTickets: allOrderTickets?.filter((t) => t.status === "bumped").length,
          allBumped,
        });

        // Only update order status if ALL tickets are bumped
        if (allBumped) {
          const { data: currentOrder } = await supabase
            .from("orders")
            .select("order_status")
            .eq("id", orderId)
            .eq("venue_id", venueId)
            .single();

          logger.debug("[KDS BULK UPDATE] All tickets bumped - updating order status", {
            orderId,
            currentStatus: currentOrder?.order_status,
            updatingTo: "READY",
          });

          const { error: orderUpdateError } = await supabase
            .from("orders")
            .update({
              order_status: "READY",
              updated_at: now,
            })
            .eq("id", orderId)
            .eq("venue_id", venueId);

          if (orderUpdateError) {
            logger.error("[KDS BULK UPDATE] Error updating order status after bump:", {
              error: orderUpdateError.message,
              orderId,
              currentStatus: currentOrder?.order_status,
              venueId,
              userId: context.user.id,
            });
          } else {
            logger.info(
              "[KDS BULK UPDATE] Order status updated to READY - all items bumped",
              {
                orderId,
                previousStatus: currentOrder?.order_status,
                venueId,
                userId: context.user.id,
              }
            );
          }
        } else {
          logger.debug("[KDS BULK UPDATE] Not all tickets bumped yet - order status unchanged", {
            orderId,
            bumpedCount: allOrderTickets?.filter((t) => t.status === "bumped").length,
            totalCount: allOrderTickets?.length,
          });
        }
      }

      logger.info("[KDS BULK UPDATE] Tickets updated successfully", {
        ticket_count: tickets?.length || 0,
        status,
        venueId,
        userId: context.user.id,
      });

      // STEP 6: Return success response
      return success({
        updated: tickets?.length || 0,
        tickets: tickets || [],
      });
    } catch (error) {
      logger.error("[KDS BULK UPDATE] Unexpected error:", {
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
  }
);
