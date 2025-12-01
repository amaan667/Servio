import { NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";

// Function to automatically backfill missing KDS tickets for orders
// Returns true if tickets were created, false otherwise
async function autoBackfillMissingTickets(venueId: string): Promise<boolean> {
  try {
    const adminSupabase = createAdminClient();

    // Get today's orders that should have KDS tickets but don't
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Query for orders that need KDS tickets
    // Include all active order statuses that need kitchen preparation
    const { data: ordersWithoutTickets, error: queryError } = await adminSupabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .in("payment_status", ["PAID", "UNPAID", "PAYMENT_PENDING"])
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "SERVED"])
      .gte("created_at", todayStart.toISOString())
      .not("id", "in", `(SELECT DISTINCT order_id FROM kds_tickets WHERE venue_id = '${venueId}')`);

    if (queryError) {
      logger.error("[KDS AUTO-BACKFILL] Error querying orders:", {
        error: queryError.message,
        venueId,
      });
      return false;
    }

    if (!ordersWithoutTickets || ordersWithoutTickets.length === 0) {
      return false;
    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Found ${ordersWithoutTickets.length} orders without KDS tickets, creating tickets...`
    );

    let ticketsCreated = 0;

    // Create tickets for orders without them using unified AI-based function
    for (const orderRef of ordersWithoutTickets) {
      const { data: order } = await adminSupabase
        .from("orders")
        .select("id, venue_id, table_number, table_id, items, customer_name")
        .eq("id", orderRef.id)
        .single();

      if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        logger.debug("[KDS AUTO-BACKFILL] Skipping order with no items:", { orderId: order?.id });
        continue;
      }

      try {
        await createKDSTicketsWithAI(adminSupabase, {
          id: order.id,
          venue_id: order.venue_id,
          items: order.items,
          customer_name: order.customer_name,
          table_number: order.table_number,
          table_id: order.table_id,
        });
        ticketsCreated += order.items.length;
      } catch (error) {
        logger.error("[KDS AUTO-BACKFILL] Failed to create tickets for order:", {
          orderId: order.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Auto-backfill completed: ${ticketsCreated} tickets created for ${ordersWithoutTickets.length} orders`
    );

    return ticketsCreated > 0;
  } catch (_error) {
    logger.error("[KDS AUTO-BACKFILL] Error during auto-backfill:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    throw _error;
  }
}

const updateTicketSchema = z.object({
  ticket_id: z.string().uuid("Invalid ticket ID"),
  status: z.enum(["new", "preparing", "ready", "bumped", "served", "cancelled"]),
});

// GET - Fetch KDS tickets for a venue or station
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Get venueId from context
      const venueId = context.venueId;
      
      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 3: Parse query parameters
      const { searchParams } = new URL(req.url);
      const stationId = searchParams.get("station_id");
      const status = searchParams.get("status");

      // STEP 4: Business logic - Fetch tickets
      const supabase = createAdminClient();

      let query = supabase
        .from("kds_tickets")
        .select(`
          *,
          kds_stations (
            id,
            station_name,
            station_type,
            color_code
          ),
          orders (
            id,
            customer_name,
            order_status,
            payment_status
          )
        `)
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false });

      if (stationId) {
        query = query.eq("station_id", stationId);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data: tickets, error: fetchError } = await query;

      if (fetchError) {
        logger.error("[KDS TICKETS] Error fetching tickets:", {
          error: fetchError.message,
          venueId,
          stationId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch KDS tickets",
          isDevelopment() ? fetchError.message : undefined
        );
      }

      // Auto-backfill missing tickets
      const backfillCreatedTickets = await autoBackfillMissingTickets(venueId);

      // Refetch if backfill created tickets or if no tickets were found initially
      let finalTickets = tickets || [];
      if (backfillCreatedTickets || !tickets || tickets.length === 0) {
        const { data: refetchedTickets } = await supabase
          .from("kds_tickets")
          .select(`
            *,
            kds_stations (
              id,
              station_name,
              station_type,
              color_code
            ),
            orders (
              id,
              customer_name,
              order_status,
              payment_status
            )
          `)
          .eq("venue_id", venueId)
          .order("created_at", { ascending: false });
        finalTickets = refetchedTickets || [];
      }

      logger.info("[KDS TICKETS] Tickets fetched successfully", {
        venueId,
        ticketCount: finalTickets.length,
        userId: context.user.id,
      });

      // STEP 5: Return success response
      return success({ tickets: finalTickets });
    } catch (error) {
      logger.error("[KDS TICKETS] Unexpected error:", {
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

// PATCH - Update ticket status
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
      const body = await validateBody(updateTicketSchema, await req.json());

      // STEP 3: Get venueId from context
      const venueId = context.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venue_id is required");
      }

      // STEP 4: Business logic - Update ticket
      const supabase = await createClient();

      const { data: updatedTicket, error: updateError } = await supabase
        .from("kds_tickets")
        .update({
          status: body.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.ticket_id)
        .eq("venue_id", venueId)
        .select()
        .single();

      if (updateError || !updatedTicket) {
        logger.error("[KDS TICKETS] Error updating ticket:", {
          error: updateError?.message,
          ticketId: body.ticket_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to update ticket",
          isDevelopment() ? updateError?.message : undefined
        );
      }

      logger.info("[KDS TICKETS] Ticket updated successfully", {
        ticketId: body.ticket_id,
        newStatus: body.status,
        venueId,
        userId: context.user.id,
      });

      // STEP 5: Return success response
      return success({ ticket: updatedTicket });
    } catch (error) {
      logger.error("[KDS TICKETS] Unexpected error:", {
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
