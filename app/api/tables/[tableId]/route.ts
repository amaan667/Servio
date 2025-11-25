import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function PUT(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        // CRITICAL: Rate limiting
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            {
              error: 'Too many requests',
              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
            },
            { status: 429 }
          );
        }

        const { tableId } = await context.params;
        const body = await req.json();
        const { label, seat_count, is_active, qr_version } = body;

        const adminSupabase = createAdminClient();

        // Update table
        const updateData: {
          label?: string;
          seat_count?: number;
          is_active?: boolean;
          updated_at: string;
          qr_version?: number;
        } = {
          label: label?.trim(),
          seat_count,
          is_active,
          updated_at: new Date().toISOString(),
        };

        if (qr_version !== undefined) {
          updateData.qr_version = qr_version;
        }

        const { data: table, error } = await adminSupabase
          .from("tables")
          .update(updateData)
          .eq("id", tableId)
          .eq("venue_id", authContext.venueId)
          .select()
          .single();

        if (error) {
          logger.error("[TABLES API] Error updating table:", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return NextResponse.json({ error: "Failed to update table" }, { status: 500 });
        }

        return NextResponse.json({ table });
      } catch (_error) {
        logger.error("[TABLES API] Unexpected error:", {
          error: _error instanceof Error ? _error.message : "Unknown _error",
        });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
          return NextResponse.json({ error: "Table not found" }, { status: 404 });
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
            return NextResponse.json(
              {
                error: "Cannot remove table with active orders. Please close all orders first.",
                hasActiveOrders: true,
              },
              { status: 400 }
            );
          }

          if (!reservationsError && activeReservations && activeReservations.length > 0) {
            return NextResponse.json(
              {
                error:
                  "Cannot remove table with active reservations. Please cancel all reservations first.",
                hasActiveReservations: true,
              },
              { status: 400 }
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
          return NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
        }

        return NextResponse.json({ success: true, deletedTable: table });
      } catch (_error) {
        logger.error("[TABLES API] Unexpected error:", {
          error: _error instanceof Error ? _error.message : "Unknown _error",
        });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
