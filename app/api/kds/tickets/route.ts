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

    // CRITICAL: Get ALL orders - NO date restrictions, NO status filters, NO subquery limitations
    // User wants ALL items from EVERY order to always be visible

    // Step 1: Get ALL orders from this venue
    const { data: allOrders, error: allOrdersError } = await adminSupabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId);

    if (allOrdersError) {
      logger.error("[KDS AUTO-BACKFILL] Error querying all orders:", {
        error: allOrdersError.message,
        venueId,
      });
      return false;
    }

    if (!allOrders || allOrders.length === 0) {
      return false;
    }

    // Step 2: Get all existing ticket order IDs
    const { data: existingTicketOrders } = await adminSupabase
      .from("kds_tickets")
      .select("order_id")
      .eq("venue_id", venueId);

    const existingOrderIds = new Set(
      (existingTicketOrders || []).map((t: { order_id: string }) => t.order_id)
    );

    // Step 3: Filter to orders without tickets (in JavaScript - more reliable)
    const ordersWithoutTickets = allOrders.filter(
      (order) => !existingOrderIds.has(order.id)
    );


    if (!ordersWithoutTickets || ordersWithoutTickets.length === 0) {
      return false;
    }

    logger.info(
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

      if (!order) {
        logger.debug("[KDS AUTO-BACKFILL] Order not found:", { orderId: orderRef.id });
        continue;
      }

      if (!Array.isArray(order.items) || order.items.length === 0) {
        logger.debug("[KDS AUTO-BACKFILL] Skipping order with no items:", { orderId: order.id });
        continue;
      }

      try {
        logger.info("[KDS AUTO-BACKFILL] Creating tickets for order:", {
          orderId: order.id,
          itemCount: order.items.length,
          venueId: order.venue_id,
        });
        await createKDSTicketsWithAI(adminSupabase, {
          id: order.id,
          venue_id: order.venue_id,
          items: order.items,
          customer_name: order.customer_name,
          table_number: order.table_number,
          table_id: order.table_id,
        });
        ticketsCreated += order.items.length;
        logger.info("[KDS AUTO-BACKFILL] Successfully created tickets for order:", {
          orderId: order.id,
          ticketsCreated: order.items.length,
        });
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
  status: z.enum(["new", "in_progress", "preparing", "ready", "bumped", "served", "cancelled"]),
  venueId: z.string().optional(), // Optional - will use from context if not provided
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

      // CRITICAL: Fetch ALL tickets - no status or date restrictions
      // User wants ALL items from EVERY order to always be visible
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
      const rawBody = await req.json();
      logger.debug("[KDS TICKETS PATCH] Update request", {
        rawBody,
        timestamp: new Date().toISOString(),
      });

      const body = await validateBody(updateTicketSchema, rawBody);

      // STEP 3: Get venueId from context or body
      const venueId = context.venueId || body.venueId;

      logger.debug("[KDS TICKETS PATCH] VenueId resolution", {
        fromContext: context.venueId,
        fromBody: body.venueId,
        final: venueId,
      });

      if (!venueId) {
        logger.error("[KDS TICKETS PATCH] No venueId available", {
          context: context,
          body: body,
        });
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 4: Business logic - Update ticket
      const supabase = await createClient();
      const now = new Date().toISOString();

      // Get the ticket first to check its order_id
      const { data: currentTicket, error: fetchError } = await supabase
        .from("kds_tickets")
        .select("order_id, status")
        .eq("id", body.ticket_id)
        .eq("venue_id", venueId)
        .single();

      if (fetchError || !currentTicket) {
        logger.error("[KDS TICKETS] Error fetching ticket:", {
          error: fetchError?.message,
          ticketId: body.ticket_id,
          venueId,
          userId: context.user.id,
        });
        return apiErrors.database(
          "Failed to fetch ticket",
          isDevelopment() ? fetchError?.message : undefined
        );
      }

      // Prepare update object with status-specific timestamps
      const updateData: {
        status: string;
        updated_at: string;
        ready_at?: string;
        started_at?: string;
        bumped_at?: string;
      } = {
        status: body.status,
        updated_at: now,
      };

      // Set timestamps based on status
      if (body.status === "ready") {
        updateData.ready_at = now;
      } else if (body.status === "preparing" || body.status === "in_progress") {
        updateData.started_at = now;
      } else if (body.status === "bumped") {
        updateData.bumped_at = now;
      }

      const { data: updatedTicket, error: updateError } = await supabase
        .from("kds_tickets")
        .update(updateData)
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

      // STEP 5: If bumping ticket, check if ALL tickets for this order are now bumped
      if (body.status === "bumped" && currentTicket.order_id) {
        const { data: allOrderTickets } = await supabase
          .from("kds_tickets")
          .select("id, status")
          .eq("order_id", currentTicket.order_id)
          .eq("venue_id", venueId);

        const allBumped = allOrderTickets?.every((t) => t.status === "bumped") || false;

        logger.debug("[KDS TICKETS] Checking if all tickets bumped", {
          orderId: currentTicket.order_id,
          totalTickets: allOrderTickets?.length,
          bumpedTickets: allOrderTickets?.filter((t) => t.status === "bumped").length,
          allBumped,
        });

        // Only update order status if ALL tickets are bumped
        if (allBumped) {
          const { data: currentOrder } = await supabase
            .from("orders")
            .select("order_status")
            .eq("id", currentTicket.order_id)
            .eq("venue_id", venueId)
            .single();

          logger.debug("[KDS TICKETS] All tickets bumped - updating order status", {
            orderId: currentTicket.order_id,
            currentStatus: currentOrder?.order_status,
            updatingTo: "READY",
          });

          const { error: orderUpdateError } = await supabase
            .from("orders")
            .update({
              order_status: "READY",
              updated_at: now,
            })
            .eq("id", currentTicket.order_id)
            .eq("venue_id", venueId);

          if (orderUpdateError) {
            logger.error("[KDS TICKETS] Error updating order status after bump:", {
              error: orderUpdateError.message,
              orderId: currentTicket.order_id,
              currentStatus: currentOrder?.order_status,
              venueId,
              userId: context.user.id,
            });
          } else {
            logger.info(
              "[KDS TICKETS] Order status updated to READY - all items bumped",
              {
                orderId: currentTicket.order_id,
                previousStatus: currentOrder?.order_status,
                venueId,
                userId: context.user.id,
              }
            );
          }
        } else {
          logger.debug("[KDS TICKETS] Not all tickets bumped yet - order status unchanged", {
            orderId: currentTicket.order_id,
            bumpedCount: allOrderTickets?.filter((t) => t.status === "bumped").length,
            totalCount: allOrderTickets?.length,
          });
        }
      }

      logger.info("[KDS TICKETS] Ticket updated successfully", {
        ticketId: body.ticket_id,
        newStatus: body.status,
        venueId,
        userId: context.user.id,
      });

      // STEP 6: Return success response
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
