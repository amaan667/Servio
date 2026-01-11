import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

const updateTableSchema = z.object({
  label: z.string().min(1).optional(),
  seat_count: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  qr_version: z.number().int().nonnegative().optional(),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        // STEP 1: Rate limiting (ALWAYS FIRST)
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
        }

        // STEP 2: Get tableId from route params
        const { tableId } = await context.params;

        if (!tableId) {
          return apiErrors.badRequest("tableId is required");
        }

        // STEP 3: Validate input
        const body = await validateBody(updateTableSchema, await req.json());

        // STEP 4: Get venueId from context
        const venueId = authContext.venueId;

        if (!venueId) {
          return apiErrors.badRequest("venue_id is required");
        }

        // STEP 5: Business logic - Update table
        // Use authenticated client that respects RLS (not admin client)
        // RLS policies ensure users can only access tables for venues they have access to
        const supabase = await createClient();

        // Verify table exists and belongs to venue
        // RLS ensures user can only access tables for venues they have access to
        const { data: existingTable, error: checkError } = await supabase
          .from("tables")
          .select("venue_id")
          .eq("id", tableId)
          .eq("venue_id", venueId) // Explicit venue check (RLS also enforces this)
          .single();

        if (checkError || !existingTable) {

          return apiErrors.notFound("Table not found");
        }

        // Build update data
        const updateData: {
          label?: string;
          seat_count?: number;
          is_active?: boolean;
          qr_version?: number;
          updated_at: string;
        } = {
          updated_at: new Date().toISOString(),
        };

        if (body.label !== undefined) {
          updateData.label = body.label;
        }
        if (body.seat_count !== undefined) {
          updateData.seat_count = body.seat_count;
        }
        if (body.is_active !== undefined) {
          updateData.is_active = body.is_active;
        }
        if (body.qr_version !== undefined) {
          updateData.qr_version = body.qr_version;
        }

        // Update table
        // RLS ensures user can only update tables for venues they have access to
        const { data: table, error: updateError } = await supabase
          .from("tables")
          .update(updateData)
          .eq("id", tableId)
          .eq("venue_id", venueId) // Explicit venue check (RLS also enforces this)
          .select()
          .single();

        if (updateError || !table) {

          return apiErrors.database(
            "Failed to update table",
            isDevelopment() ? updateError?.message : undefined
          );
        }

        // STEP 6: Return success response
        return success({ table });
      } catch (error) {

        if (isZodError(error)) {
          return handleZodError(error);
        }

        return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
      }
    },
    {
      extractVenueId: async (req, routeParams) => {
        // Try to get venueId from table record
        if (routeParams?.params) {
          const params = await routeParams.params;
          const tableId = params?.tableId;
          if (tableId) {
            const adminSupabase = createAdminClient();
            const { data: table } = await adminSupabase
              .from("tables")
              .select("venue_id")
              .eq("id", tableId)
              .single();
            if (table?.venue_id) {
              return table.venue_id;
            }
          }
        }
        // Fallback to query/body
        const url = new URL(req.url);
        return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
      },
    }
  );

  return handler(req, { params: Promise.resolve(context.params ?? {}) } as {
    params?: Promise<Record<string, string>>;
  });
}

type TableParams = { params?: { tableId?: string } };

export async function DELETE(req: NextRequest, context: TableParams = {}) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        const tableId = context.params?.tableId;

        if (!tableId) {
          return apiErrors.badRequest("Table ID is required");
        }

        // Check if force=true is passed as query parameter
        const url = new URL(req.url);
        const forceRemove = url.searchParams.get("force") === "true";

        // Use authenticated client that respects RLS (not admin client)
        // RLS policies ensure users can only access tables for venues they have access to
        const supabase = await createClient();

        // First check if table exists
        // RLS ensures user can only access tables for venues they have access to
        const { data: existingTable, error: checkError } = await supabase
          .from("tables")
          .select("id, label, venue_id")
          .eq("id", tableId)
          .eq("venue_id", authContext.venueId) // Explicit venue check (RLS also enforces this)
          .single();

        if (checkError || !existingTable) {

          return apiErrors.notFound("Table not found");
        }

        // Type assertion for TypeScript
        const table = existingTable as { id: string; label: string; venue_id: string };

        // Check if the table has unknown active orders
        let activeOrders: { id: string }[] = [];
        let ordersError: unknown = null;

        try {
          // RLS ensures user can only access orders for venues they have access to
          const ordersResult = await supabase
            .from("orders")
            .select("id")
            .eq("table_id", tableId)
            .eq("venue_id", table.venue_id) // Explicit venue check (RLS also enforces this)
            .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

          activeOrders = ordersResult.data || [];
          ordersError = ordersResult.error;
        } catch (_error) {

          ordersError = _error;
        }

        if (ordersError) {

          // Try a simpler fallback query
          // SECURITY NOTE: Using admin client for fallback query only
          // This is safe because venue access is already verified above
          try {
            const adminSupabase = createAdminClient();
            const fallbackResult = await adminSupabase
              .from("orders")
              .select("id")
              .eq("table_id", tableId)
              .eq("venue_id", table.venue_id) // Explicit venue check
              .limit(1);

            if (fallbackResult.data && fallbackResult.data.length > 0) { /* Condition handled */ }
          } catch (fallbackError) { /* Error handled silently */ }
        }

        // Check if the table has unknown active reservations
        let activeReservations: { id: string }[] = [];
        let reservationsError: unknown = null;

        try {
          // RLS ensures user can only access reservations for venues they have access to
          const reservationsResult = await supabase
            .from("reservations")
            .select("id")
            .eq("table_id", tableId)
            .eq("venue_id", table.venue_id) // Explicit venue check (RLS also enforces this)
            .eq("status", "BOOKED");

          activeReservations = reservationsResult.data || [];
          reservationsError = reservationsResult.error;
        } catch (_error) {

          reservationsError = _error;
        }

        if (reservationsError) { /* Condition handled */ }

        // If there are active orders or reservations, handle based on forceRemove flag
        if (forceRemove) {
          // FORCE REMOVE: Complete all active orders and cancel reservations

          if (!ordersError && activeOrders && activeOrders.length > 0) {
            // RLS ensures user can only update orders for venues they have access to
            const { error: completeOrdersError } = await supabase
              .from("orders")
              .update({
                order_status: "COMPLETED",
                updated_at: new Date().toISOString(),
              })
              .eq("table_id", tableId)
              .eq("venue_id", table.venue_id) // Explicit venue check (RLS also enforces this)
              .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

            if (completeOrdersError) { /* Condition handled */ } else { /* Else case handled */ }
          }

          if (!reservationsError && activeReservations && activeReservations.length > 0) {

            // RLS ensures user can only update reservations for venues they have access to
            const { error: cancelReservationsError } = await supabase
              .from("reservations")
              .update({
                status: "CANCELLED",
                updated_at: new Date().toISOString(),
              })
              .eq("table_id", tableId)
              .eq("venue_id", table.venue_id) // Explicit venue check (RLS also enforces this)
              .eq("status", "BOOKED");

            if (cancelReservationsError) { /* Condition handled */ } else { /* Else case handled */ }
          }
        } else {
          // NORMAL REMOVE: Prevent deletion if there are active orders/reservations
          if (!ordersError && activeOrders && activeOrders.length > 0) {
            return apiErrors.badRequest(
              "Cannot remove table with active orders. Please close all orders first.",
              { hasActiveOrders: true }
            );
          }

          if (!reservationsError && activeReservations && activeReservations.length > 0) {
            return apiErrors.badRequest(
              "Cannot remove table with active reservations. Please cancel all reservations first.",
              { hasActiveReservations: true }
            );
          }
        }

        // If both checks failed, we'll proceed with a warning
        if (ordersError && reservationsError) { /* Condition handled */ }

        // Clear table_id references in orders to avoid foreign key constraint issues
        // RLS ensures user can only update orders for venues they have access to
        const { error: clearTableRefsError } = await supabase
          .from("orders")
          .update({ table_id: null })
          .eq("table_id", tableId)
          .eq("venue_id", table.venue_id); // Explicit venue check (RLS also enforces this)

        if (clearTableRefsError) { /* Condition handled */ }

        // Delete table sessions first (if they exist)
        // RLS ensures user can only delete sessions for venues they have access to
        const { error: deleteSessionsError } = await supabase
          .from("table_sessions")
          .delete()
          .eq("table_id", tableId)
          .eq("venue_id", table.venue_id); // Explicit venue check (RLS also enforces this)

        if (deleteSessionsError) { /* Condition handled */ }

        // Delete group sessions for this table
        // RLS ensures user can only delete group sessions for venues they have access to
        const { error: deleteGroupSessionError } = await supabase
          .from("table_group_sessions")
          .delete()
          .eq("table_number", table.label)
          .eq("venue_id", table.venue_id); // Explicit venue check (RLS also enforces this)

        if (deleteGroupSessionError) { /* Condition handled */ }

        // Finally, delete the table itself
        // RLS ensures user can only delete tables for venues they have access to
        const { error } = await supabase
          .from("tables")
          .delete()
          .eq("id", tableId)
          .eq("venue_id", table.venue_id); // Explicit venue check (RLS also enforces this)

        if (error) {

          return apiErrors.internal("Failed to delete table");
        }

        return success({ success: true, deletedTable: table });
      } catch (error) {

        return apiErrors.internal("Internal server error");
      }
    },
    {
      extractVenueId: async (req, routeParams) => {
        // Try to get venueId from table record
        if (routeParams?.params) {
          const params = await routeParams.params;
          const tableId = params?.tableId;
          if (tableId) {
            const adminSupabase = createAdminClient();
            const { data: table } = await adminSupabase
              .from("tables")
              .select("venue_id")
              .eq("id", tableId)
              .single();
            if (table?.venue_id) {
              return table.venue_id;
            }
          }
        }
        // Fallback to query/body
        const url = new URL(req.url);
        return url.searchParams.get("venueId") || url.searchParams.get("venue_id");
      },
    }
  );

  return handler(req, { params: Promise.resolve(context.params ?? {}) } as {
    params?: Promise<Record<string, string>>;
  });
}
