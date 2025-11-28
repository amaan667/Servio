import { NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

// Function to automatically backfill missing KDS tickets for orders
async function autoBackfillMissingTickets(venueId: string) {
  try {
    const adminSupabase = createAdminClient();

    // Get today's orders that should have KDS tickets but don't
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: ordersWithoutTickets } = await adminSupabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .in("payment_status", ["PAID", "UNPAID"])
      .in("order_status", ["PLACED", "IN_PREP", "READY"])
      .gte("created_at", todayStart.toISOString())
      .not("id", "in", `(SELECT DISTINCT order_id FROM kds_tickets WHERE venue_id = '${venueId}')`);

    if (!ordersWithoutTickets || ordersWithoutTickets.length === 0) {
      return;
    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Found ${ordersWithoutTickets.length} orders without KDS tickets, creating tickets...`
    );

    // Get expo station for this venue
    const { data: expoStation } = await adminSupabase
      .from("kds_stations")
      .select("id")
      .eq("venue_id", venueId)
      .eq("station_type", "expo")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!expoStation) {
      return;
    }

    // Create tickets for orders without them
    for (const orderRef of ordersWithoutTickets) {
      const { data: order } = await adminSupabase
        .from("orders")
        .select("id, venue_id, table_number, table_id, items")
        .eq("id", orderRef.id)
        .single();

      if (!order || !Array.isArray(order.items)) continue;

      // Create tickets for each item
      for (const item of order.items) {
        const ticketData = {
          venue_id: order.venue_id,
          order_id: order.id,
          station_id: expoStation.id,
          item_name: item.item_name || "Unknown Item",
          quantity: parseInt(String(item.quantity)) || 1,
          special_instructions: item.specialInstructions || null,
          table_number: order.table_number,
          table_label: order.table_id || order.table_number?.toString() || "Unknown",
          status: "new",
        };

        await adminSupabase.from("kds_tickets").insert(ticketData);
      }
    }

    logger.debug(
      `[KDS AUTO-BACKFILL] Auto-backfill completed for ${ordersWithoutTickets.length} orders`
    );
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
      const supabase = await createClient();

      let query = supabase
        .from("kds_tickets")
        .select("*")
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
      await autoBackfillMissingTickets(venueId);

      // Refetch if backfill occurred
      let finalTickets = tickets || [];
      if (!tickets || tickets.length === 0) {
        const { data: refetchedTickets } = await supabase
          .from("kds_tickets")
          .select("*")
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
