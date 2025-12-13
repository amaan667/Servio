import { NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import { createKDSTicketsWithAI } from "@/lib/orders/kds-tickets-unified";

function looksLikeMissingLifecycleColumn(message: string): boolean {
  const m = message.toLowerCase();
  // Supabase/PostgREST errors vary, but missing columns usually include the column name.
  return (
    m.includes("completion_status") ||
    m.includes("kitchen_status") ||
    m.includes("service_status") ||
    m.includes("payment_method")
  );
}

// Function to automatically backfill missing KDS tickets for orders
// Returns true if tickets were created, false otherwise
// SECURITY: This function is called from within withUnifiedAuth context, so venue access is already verified
// However, it uses admin client for backfill operations which may need system-level access
// TODO: Consider if this can use authenticated client instead
async function autoBackfillMissingTickets(venueId: string): Promise<boolean> {
  try {
    // SECURITY NOTE: Using admin client for backfill operations
    // This is called from within withUnifiedAuth context where venue access is verified
    // Admin client is used here because backfill may need to create tickets for historical orders
    // Consider migrating to authenticated client if RLS policies allow
    const adminSupabase = createAdminClient();

    // CRITICAL: Get ALL orders - NO date restrictions, NO status filters, NO subquery limitations
    // User wants ALL items from EVERY order to always be visible

    // Step 1: Get OPEN orders from this venue (KDS only shows OPEN orders)
    // NOTE: Production may not have the unified lifecycle migration applied yet.
    // Fall back gracefully if new columns are missing.
    let allOrders: Array<Record<string, unknown>> | null = null;
    const allOrdersResult = await adminSupabase
      .from("orders")
      .select("id, payment_method, payment_status, completion_status")
      .eq("venue_id", venueId)
      .eq("completion_status", "OPEN");

    if (allOrdersResult.error) {
      // Backwards compatibility: if completion_status/payment_method columns don't exist yet, refetch without them
      if (looksLikeMissingLifecycleColumn(allOrdersResult.error.message)) {
        const legacyOrdersResult = await adminSupabase
          .from("orders")
          .select("id, payment_method, payment_status")
          .eq("venue_id", venueId);
        if (legacyOrdersResult.error) {
          logger.error("[KDS AUTO-BACKFILL] Error querying orders (legacy fallback):", {
            error: legacyOrdersResult.error.message,
            venueId,
          });
          return false;
        }
        allOrders = legacyOrdersResult.data as Array<Record<string, unknown>> | null;
      } else {
        logger.error("[KDS AUTO-BACKFILL] Error querying all orders:", {
          error: allOrdersResult.error.message,
          venueId,
        });
        return false;
      }
    } else {
      allOrders = allOrdersResult.data as Array<Record<string, unknown>> | null;
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
    const ordersWithoutTickets = (allOrders || []).filter((order) => {
      const id = String((order as { id?: unknown }).id || "");
      if (!id) return false;
      if (existingOrderIds.has(id)) return false;

      // Don't backfill KDS tickets for unpaid PAY_NOW orders (kitchen should only see paid PAY_NOW)
      const method = String((order as { payment_method?: unknown }).payment_method || "").toUpperCase();
      const status = String((order as { payment_status?: unknown }).payment_status || "").toUpperCase();
      if (method === "PAY_NOW" && status !== "PAID") return false;
      return true;
    });

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
        .eq("id", String(orderRef.id))
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
export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
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
    // Use authenticated client that respects RLS (not admin client)
    // RLS policies ensure users can only access tickets for venues they have access to
    const supabase = await createClient();

    // CRITICAL: Fetch ALL tickets - no status or date restrictions
    // Show tickets for OPEN orders only (completed orders should drop out of operational views)
    const selectWithLifecycle = `
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
            kitchen_status,
            service_status,
            completion_status,
            payment_method,
            payment_status
          )
        `;
    const selectLegacy = `
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
        `;

    let query = supabase
      .from("kds_tickets")
      .select(selectWithLifecycle)
      .eq("venue_id", venueId)
      .eq("orders.completion_status", "OPEN")
      .order("created_at", { ascending: false });

    if (stationId) {
      query = query.eq("station_id", stationId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    let tickets: unknown[] | null = null;
    const firstAttempt = await query;
    if (firstAttempt.error) {
      // Backwards compatibility: if lifecycle columns aren't in prod yet, fall back to legacy select.
      if (looksLikeMissingLifecycleColumn(firstAttempt.error.message)) {
        let legacyQuery = supabase
          .from("kds_tickets")
          .select(selectLegacy)
          .eq("venue_id", venueId)
          .order("created_at", { ascending: false });
        if (stationId) legacyQuery = legacyQuery.eq("station_id", stationId);
        if (status) legacyQuery = legacyQuery.eq("status", status);
        const legacyAttempt = await legacyQuery;
        if (legacyAttempt.error) {
          logger.error("[KDS TICKETS] Error fetching tickets (legacy fallback):", {
            error: legacyAttempt.error.message,
            venueId,
            stationId,
            userId: context.user.id,
          });
          return apiErrors.database(
            "Failed to fetch KDS tickets",
            isDevelopment() ? legacyAttempt.error.message : undefined
          );
        }
        tickets = legacyAttempt.data as unknown[] | null;
      } else {
        const fetchError = firstAttempt.error;
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
    } else {
      tickets = firstAttempt.data as unknown[] | null;
    }

    // Auto-backfill missing tickets
    const backfillCreatedTickets = await autoBackfillMissingTickets(venueId);

    // Refetch if backfill created tickets or if no tickets were found initially
    let finalTickets = tickets || [];
    if (backfillCreatedTickets || !tickets || tickets.length === 0) {
      const refetchAttempt = await supabase
        .from("kds_tickets")
        .select(selectWithLifecycle)
        .eq("venue_id", venueId)
        .eq("orders.completion_status", "OPEN")
        .order("created_at", { ascending: false });

      if (refetchAttempt.error && looksLikeMissingLifecycleColumn(refetchAttempt.error.message)) {
        const legacyRefetch = await supabase
          .from("kds_tickets")
          .select(selectLegacy)
          .eq("venue_id", venueId)
          .order("created_at", { ascending: false });
        finalTickets = (legacyRefetch.data as unknown[] | null) || [];
      } else {
        finalTickets = (refetchAttempt.data as unknown[] | null) || [];
      }
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

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});

// PATCH - Update ticket status
export const PATCH = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
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

      // Only update order kitchen_status if ALL tickets are bumped
      if (allBumped) {
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("order_status, kitchen_status")
          .eq("id", currentTicket.order_id)
          .eq("venue_id", venueId)
          .single();

        logger.debug("[KDS TICKETS] All tickets bumped - updating order kitchen_status", {
          orderId: currentTicket.order_id,
          currentStatus: currentOrder?.order_status,
          currentKitchenStatus: (currentOrder as { kitchen_status?: unknown })?.kitchen_status,
          updatingTo: "BUMPED",
        });

        const { error: orderUpdateError } = await supabase.rpc("orders_set_kitchen_bumped", {
          p_order_id: currentTicket.order_id,
          p_venue_id: venueId,
        });

        if (orderUpdateError) {
          logger.error("[KDS TICKETS] Error updating order kitchen_status after bump:", {
            error: orderUpdateError.message,
            orderId: currentTicket.order_id,
            currentStatus: currentOrder?.order_status,
            venueId,
            userId: context.user.id,
          });
        } else {
          logger.info("[KDS TICKETS] Order kitchen_status updated to BUMPED - all items bumped", {
            orderId: currentTicket.order_id,
            previousStatus: currentOrder?.order_status,
            venueId,
            userId: context.user.id,
          });
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

    return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
  }
});
