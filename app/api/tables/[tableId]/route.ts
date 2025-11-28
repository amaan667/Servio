import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

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
          return apiErrors.rateLimit(
            Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
          );
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
        const adminSupabase = createAdminClient();

        // Verify table exists and belongs to venue
        const { data: existingTable, error: checkError } = await adminSupabase
          .from("tables")
          .select("venue_id")
          .eq("id", tableId)
          .eq("venue_id", venueId)
          .single();

        if (checkError || !existingTable) {
          logger.error("[TABLES PUT] Table not found:", {
            error: checkError?.message,
            tableId,
            venueId,
            userId: authContext.user.id,
          });
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
        const { data: table, error: updateError } = await adminSupabase
          .from("tables")
          .update(updateData)
          .eq("id", tableId)
          .eq("venue_id", venueId)
          .select()
          .single();

        if (updateError || !table) {
          logger.error("[TABLES PUT] Error updating table:", {
            error: updateError?.message,
            tableId,
            venueId,
            userId: authContext.user.id,
          });
          return apiErrors.database(
            "Failed to update table",
            isDevelopment() ? updateError?.message : undefined
          );
        }

        logger.info("[TABLES PUT] Table updated successfully", {
          tableId,
          venueId,
          userId: authContext.user.id,
        });

        // STEP 6: Return success response
        return success({ table });
      } catch (error) {
        logger.error("[TABLES PUT] Unexpected error:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          venueId: authContext.venueId,
          userId: authContext.user.id,
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

  return handler(req, context);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        const { tableId } = await context.params;

        // Check if force=true is passed as query parameter
        const url = new URL(req.url);
        const forceRemove = url.searchParams.get("force") === "true";

        const adminSupabase = createAdminClient();

        // First check if table exists
        const { data: existingTable, error: checkError } = await adminSupabase
          .from("tables")
          .select("id, label, venue_id")
          .eq("id", tableId)
          .eq("venue_id", authContext.venueId)
          .single();

        if (checkError || !existingTable) {
          logger.error("[TABLES API] Error checking table existence:", { value: checkError });
          return apiErrors.notFound('Table not found');
        }

        // Type assertion for TypeScript
        const table = existingTable as { id: string; label: string; venue_id: string };

        // Check if the table has unknown active orders
        let activeOrders: { id: string }[] = [];
        let ordersError: unknown = null;

        try {
          const ordersResult = await adminSupabase
            .from("orders")
            .select("id")
            .eq("table_id", tableId)
            .eq("venue_id", table.venue_id)
            .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

          activeOrders = ordersResult.data || [];
          ordersError = ordersResult.error;
        } catch (_error) {
          logger.error("[TABLES API] Exception during active orders check:", {
            error: _error instanceof Error ? _error.message : "Unknown error",
          });
          ordersError = _error;
        }

        if (ordersError) {
          logger.error("[TABLES API] Error checking active orders:", { value: ordersError });
          logger.warn(
            "[TABLES API] Proceeding with table removal despite orders check failure - this may be due to database connectivity issues"
          );

          // Try a simpler fallback query
          try {
            const fallbackResult = await adminSupabase
              .from("orders")
              .select("id")
              .eq("table_id", tableId)
              .limit(1);

            if (fallbackResult.data && fallbackResult.data.length > 0) {
              logger.warn(
                "[TABLES API] Fallback query found orders for this table - proceeding with caution"
              );
            }
          } catch (fallbackError) {
            logger.error("[TABLES API] Fallback query also failed:", { value: fallbackError });
          }
        }

        // Check if the table has unknown active reservations
        let activeReservations: { id: string }[] = [];
        let reservationsError: unknown = null;

        try {
          const reservationsResult = await adminSupabase
            .from("reservations")
            .select("id")
            .eq("table_id", tableId)
            .eq("venue_id", table.venue_id)
            .eq("status", "BOOKED");

          activeReservations = reservationsResult.data || [];
          reservationsError = reservationsResult.error;
        } catch (_error) {
          logger.error("[TABLES API] Exception during active reservations check:", {
            error: _error instanceof Error ? _error.message : "Unknown error",
          });
          reservationsError = _error;
        }

        if (reservationsError) {
          logger.error("[TABLES API] Error checking active reservations:", {
            value: reservationsError,
          });
          logger.warn(
            "[TABLES API] Proceeding with table removal despite reservations check failure - this may be due to database connectivity issues"
          );
        }

        // If there are active orders or reservations, handle based on forceRemove flag
        if (forceRemove) {
          // FORCE REMOVE: Complete all active orders and cancel reservations
          logger.info(
            "[TABLES API] Force remove enabled - completing active orders and canceling reservations"
          );

          if (!ordersError && activeOrders && activeOrders.length > 0) {
            const { error: completeOrdersError } = await adminSupabase
              .from("orders")
              .update({
                order_status: "COMPLETED",
                updated_at: new Date().toISOString(),
              })
              .eq("table_id", tableId)
              .eq("venue_id", table.venue_id)
              .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING"]);

            if (completeOrdersError) {
              logger.error("[TABLES API] Error force completing orders:", {
                value: completeOrdersError,
              });
            } else {
              logger.info("[TABLES API] Successfully force completed active orders");
            }
          }

          if (!reservationsError && activeReservations && activeReservations.length > 0) {
            logger.info(
              `[TABLES API] Force canceling ${activeReservations.length} active reservations`
            );
            const { error: cancelReservationsError } = await adminSupabase
              .from("reservations")
              .update({
                status: "CANCELLED",
                updated_at: new Date().toISOString(),
              })
              .eq("table_id", tableId)
              .eq("venue_id", table.venue_id)
              .eq("status", "BOOKED");

            if (cancelReservationsError) {
              logger.error("[TABLES API] Error force canceling reservations:", {
                value: cancelReservationsError,
              });
            } else {
              logger.info("[TABLES API] Successfully force canceled active reservations");
            }
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
        if (ordersError && reservationsError) {
          logger.warn(
            "[TABLES API] Both orders and reservations checks failed - proceeding with table removal but logging the issue"
          );
        }

        // Clear table_id references in orders to avoid foreign key constraint issues
        const { error: clearTableRefsError } = await adminSupabase
          .from("orders")
          .update({ table_id: null })
          .eq("table_id", tableId)
          .eq("venue_id", table.venue_id);

        if (clearTableRefsError) {
          logger.error("[TABLES API] Error clearing table references in orders:", {
            value: clearTableRefsError,
          });
          logger.warn(
            "[TABLES API] Proceeding with table deletion despite table reference clear failure"
          );
        }

        // Delete table sessions first (if they exist)
        const { error: deleteSessionsError } = await adminSupabase
          .from("table_sessions")
          .delete()
          .eq("table_id", tableId)
          .eq("venue_id", table.venue_id);

        if (deleteSessionsError) {
          logger.error("[TABLES API] Error deleting table sessions:", { value: deleteSessionsError });
          logger.warn("[TABLES API] Proceeding with table deletion despite session deletion failure");
        }

        // Delete group sessions for this table
        const { error: deleteGroupSessionError } = await adminSupabase
          .from("table_group_sessions")
          .delete()
          .eq("table_number", table.label)
          .eq("venue_id", table.venue_id);

        if (deleteGroupSessionError) {
          logger.error("[TABLES API] Error deleting group sessions:", {
            value: deleteGroupSessionError,
          });
          logger.warn(
            "[TABLES API] Proceeding with table deletion despite group session deletion failure"
          );
        }

        // Finally, delete the table itself using admin client to bypass RLS
        const { error } = await adminSupabase
          .from("tables")
          .delete()
          .eq("id", tableId)
          .eq("venue_id", table.venue_id);

        if (error) {
          logger.error("[TABLES API] Error deleting table:", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
          logger.error("[TABLES API] Error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          return apiErrors.internal('Failed to delete table');
        }

        return success({ success: true, deletedTable: table });
      } catch (error) {
        logger.error("[TABLES API] Unexpected error:", {
          error: error instanceof Error ? error.message : String(error),
        });
        return apiErrors.internal('Internal server error');
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

  return handler(req, context);
}
