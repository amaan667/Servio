import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { NextRequest } from "next/server";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { getRequestMetadata, getIdempotencyKey } from "@/lib/api/request-helpers";
import { checkIdempotency, storeIdempotency } from "@/lib/db/idempotency";

export const runtime = "nodejs";

interface TableRow {
  id: string;
  table_id?: string;
  table_number?: number;
  label?: string;
  [key: string]: unknown;
}

// GET /api/tables?venueId=xxx - Get table runtime state for a venue
// SECURITY: Uses authenticated client that respects RLS (not admin client)
// This ensures venue isolation is enforced at the database level
export const GET = withUnifiedAuth(async (req: NextRequest, context) => {
  const requestMetadata = getRequestMetadata(req);
  const requestId = requestMetadata.correlationId;
  
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(undefined, requestId);
    }

    // Use authenticated client that respects RLS (not admin client)
    const supabase = await createClient();

    // Fetch all active tables for the venue
    // RLS ensures user can only access tables for venues they have access to
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("*")
      .eq("venue_id", context.venueId)
      .eq("is_active", true)
      .order("label", { ascending: true });

    if (tablesError) {

      return apiErrors.database(
        "Failed to fetch tables",
        isDevelopment() ? tablesError.message : undefined
      );
    }

    // Get current sessions for each table (only active sessions)
    // RLS ensures user can only access sessions for venues they have access to
    const { data: sessions, error: sessionsError } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("venue_id", context.venueId)
      .in("table_id", (tables as unknown as TableRow[])?.map((t) => t.id) || [])
      .is("closed_at", null); // Only get active sessions

    // Get orders for sessions that have order_id to check completion_status
    const sessionOrderIds = (sessions || [])
      .map((s: Record<string, unknown>) => s.order_id as string)
      .filter((id): id is string => !!id);

    let orderCompletionMap: Record<string, { completion_status?: string; order_status?: string }> =
      {};
    if (sessionOrderIds.length > 0) {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, completion_status, order_status")
        .in("id", sessionOrderIds)
        .eq("venue_id", context.venueId);

      if (orders) {
        orderCompletionMap = orders.reduce(
          (acc, order) => {
            acc[order.id] = {
              completion_status: order.completion_status,
              order_status: order.order_status,
            };
            return acc;
          },
          {} as Record<string, { completion_status?: string; order_status?: string }>
        );
      }
    }

    if (sessionsError) {

      return apiErrors.database(
        "Failed to fetch table sessions",
        isDevelopment() ? sessionsError.message : undefined
      );
    }

    // Combine tables with their sessions
    // Filter out sessions where the order is completed (table should be FREE)
    const tablesWithSessions =
      tables?.map((table: Record<string, unknown>) => {
        const session = sessions?.find((s: Record<string, unknown>) => s.table_id === table.id) as
          | Record<string, unknown>
          | undefined;

        // Check if the session's order is completed
        const sessionOrderId = session?.order_id as string | null | undefined;
        const order = sessionOrderId ? orderCompletionMap[sessionOrderId] : null;
        const isOrderCompleted =
          order?.completion_status?.toUpperCase() === "COMPLETED" ||
          (order?.order_status &&
            ["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(
              order.order_status.toUpperCase()
            ));

        // If order is completed, treat session as if it doesn't exist (table is FREE)
        const effectiveSession = isOrderCompleted ? null : session;

        const tableRecord = table as Record<string, unknown>;
        const result = {
          ...tableRecord,
          table_id: tableRecord.id as string, // Add table_id field for consistency with TableRuntimeState interface
          merged_with_table_id: (tableRecord.merged_with_table_id as string | null) || null, // Include merge relationship
          session_id: (effectiveSession?.id as string | null) || null,
          status: isOrderCompleted ? "FREE" : (effectiveSession?.status as string) || "FREE",
          order_id: isOrderCompleted ? null : (effectiveSession?.order_id as string | null) || null,
          opened_at: (effectiveSession?.opened_at as string | null) || null,
          closed_at: (effectiveSession?.closed_at as string | null) || null,
          total_amount: (effectiveSession?.total_amount as number | null) || null,
          customer_name: (effectiveSession?.customer_name as string | null) || null,
          order_status: isOrderCompleted
            ? null
            : (effectiveSession?.order_status as string | null) || null,
          completion_status: order?.completion_status || null, // Include completion_status for table state logic
          // If order is completed, automatically close the session (cleanup)
          ...(isOrderCompleted && effectiveSession
            ? {
                // Trigger cleanup: close session and clear order_id
                _shouldCleanup: true,
              }
            : {}),
          payment_status: (effectiveSession?.payment_status as string | null) || null,
          order_updated_at: (effectiveSession?.order_updated_at as string | null) || null,
          reservation_time: (effectiveSession?.reservation_time as string | null) || null,
          reservation_duration_minutes:
            (effectiveSession?.reservation_duration_minutes as number | null) || null,
          reservation_end_time: (effectiveSession?.reservation_end_time as string | null) || null,
          reservation_created_at:
            (effectiveSession?.reservation_created_at as string | null) || null,
          most_recent_activity:
            (effectiveSession?.most_recent_activity as string) ||
            (tableRecord.table_created_at as string),
          reserved_now_id: null,
          reserved_now_start: null,
          reserved_now_end: null,
          reserved_now_name: null,
          reserved_now_phone: null,
          reserved_later_id: null,
          reserved_later_start: null,
          reserved_later_end: null,
          reserved_later_name: null,
          reserved_later_phone: null,
          block_window_mins: 0,
        };

        return result;
      }) || [];

    // Proactively clean up sessions with completed orders (background cleanup)
    // This ensures tables are freed immediately when orders complete
    const sessionsToCleanup = (sessions || []).filter((s: Record<string, unknown>) => {
      const orderId = s.order_id as string | null | undefined;
      if (!orderId) return false;
      const order = orderCompletionMap[orderId];
      return (
        order?.completion_status?.toUpperCase() === "COMPLETED" ||
        (order?.order_status &&
          ["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(
            order.order_status.toUpperCase()
          ))
      );
    });

    if (sessionsToCleanup.length > 0) {
      // Clean up in background (don't block response)
      Promise.all(
        sessionsToCleanup.map(async (session: Record<string, unknown>) => {
          const sessionId = session.id as string;
          const orderId = session.order_id as string;
          const tableId = session.table_id as string;
          const tableNumber = session.table_number as number | null;

          try {
            // Close the session and clear order_id
            await supabase
              .from("table_sessions")
              .update({
                status: "FREE",
                order_id: null,
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", sessionId);

            // Also clear table runtime state if we have table_number
            if (tableNumber) {
              await supabase
                .from("table_runtime_state")
                .update({
                  primary_status: "FREE",
                  order_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("venue_id", context.venueId)
                .eq("label", `Table ${tableNumber}`);
            }

            // Clear by table_id if available
            if (tableId) {
              await supabase
                .from("table_runtime_state")
                .update({
                  primary_status: "FREE",
                  order_id: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("venue_id", context.venueId)
                .eq("table_id", tableId);
            }

          } catch (cleanupError) { /* Error handled silently */ }
        })
      ).catch((_error) => {
        // Cleanup errors handled silently
      });
    }

    // Ensure all tables have active sessions (create missing ones)
    const tablesWithoutSessions = tablesWithSessions.filter((t) => !t.session_id);

    if (tablesWithoutSessions.length > 0) {
      for (const table of tablesWithoutSessions) {
        const tableWithId = table as { table_id?: string; id?: string };
        const tableId = tableWithId.table_id || tableWithId.id;
        // RLS ensures user can only create sessions for venues they have access to
        const { error: sessionError } = await supabase.from("table_sessions").insert({
          venue_id: context.venueId,
          table_id: tableId,
          status: "FREE",
          opened_at: new Date().toISOString(),
          closed_at: null,
        });

        if (sessionError) { /* Condition handled */ }
      }

      // Refetch sessions after creating missing ones
      // RLS ensures user can only access sessions for venues they have access to
      const { data: updatedSessions } = await supabase
        .from("table_sessions")
        .select("*")
        .eq("venue_id", context.venueId)
        .in("table_id", (tables as unknown as TableRow[])?.map((t) => t.id) || [])
        .is("closed_at", null);

      // Update the tables with the new sessions
      tablesWithSessions.forEach((table: Record<string, unknown>) => {
        if (!table.session_id) {
          const tableWithId = table as { table_id?: string; id?: string };
          const tableId = tableWithId.table_id || tableWithId.id;
          const newSession = updatedSessions?.find(
            (s: Record<string, unknown>) => (s.table_id as string) === tableId
          ) as Record<string, unknown> | undefined;
          if (newSession) {
            table.session_id = newSession.id as string | null;
            table.status = newSession.status as string;
            table.opened_at = newSession.opened_at as string | null;
          }
        }
      });
    }

    return success(
      { tables: tablesWithSessions },
      { timestamp: new Date().toISOString(), requestId },
      requestId
    );
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal(
      "Request processing failed",
      isDevelopment() ? error : undefined,
      requestId
    );
  }
});

// POST /api/tables - Create a new table
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  const requestMetadata = getRequestMetadata(req);
  const requestId = requestMetadata.correlationId;
  
  // Log route entry (only in development)
  if (isDevelopment()) {
    // Development mode logging
  }

  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000), requestId);
    }

    // STEP 2: Validate input
    const body = await req.json();

    // Optional idempotency check (non-breaking - only if header is provided)
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const existing = await checkIdempotency(idempotencyKey);
      if (existing.exists) {
        return success(
          existing.response.response_data as { table: unknown; message: string },
          { timestamp: new Date().toISOString(), requestId },
          requestId
        );
      }
    }
    const { label, seat_count, area } = body;

    if (!label) {
      return apiErrors.badRequest("label is required");
    }

    // STEP 3: Check tier limits for table count
    const { checkLimit } = await import("@/lib/tier-restrictions");
    const { createAdminClient } = await import("@/lib/supabase");
    const adminSupabase = createAdminClient();

    // Get venue owner to check tier limits
    const { data: venue } = await adminSupabase
      .from("venues")
      .select("owner_user_id")
      .eq("venue_id", context.venueId)
      .single();

    if (!venue) {
      return apiErrors.notFound("Venue not found");
    }

    // Count current tables (active only)
    const { count: currentTableCount } = await adminSupabase
      .from("tables")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", context.venueId)
      .eq("is_active", true);

    const tableCount = currentTableCount || 0;

    // Check tier limit
    // IMPORTANT: Tier limits are based on the venue owner's subscription
    const limitCheck = await checkLimit(venue.owner_user_id, "maxTables", tableCount);
    if (!limitCheck.allowed) {

      return apiErrors.forbidden(
        `Table limit reached. You have ${tableCount}/${limitCheck.limit} tables. Upgrade to ${limitCheck.currentTier === "starter" ? "Pro" : "Enterprise"} tier for more tables.`,
        {
          limitReached: true,
          currentCount: tableCount,
          limit: limitCheck.limit,
          tier: limitCheck.currentTier,
        }
      );
    }

    // STEP 4: Business logic
    // Use authenticated client that respects RLS (not admin client)
    // RLS policies ensure users can only create tables for venues they have access to
    const supabase = await createClient();

    // Check if a table with the same label already exists
    // RLS ensures user can only access tables for venues they have access to
    const { data: existingTable } = await supabase
      .from("tables")
      .select("id, label")
      .eq("venue_id", context.venueId) // Explicit venue check (RLS also enforces this)
      .eq("label", label)
      .eq("is_active", true)
      .maybeSingle();

    if (existingTable) {

      return apiErrors.badRequest(
        `Table "${label}" already exists. Please choose a different label.`
      );
    }

    // Create table
    // RLS ensures user can only create tables for venues they have access to
    const { data: table, error: tableError } = await supabase
      .from("tables")
      .insert({
        venue_id: context.venueId,
        label,
        seat_count: seat_count || null,
        area: area || null,
      })
      .select()
      .single();

    if (tableError || !table) {

      return apiErrors.database(
        "Failed to create table",
        isDevelopment() ? tableError?.message : undefined
      );
    }

    // Check if session already exists for this table

    // RLS ensures user can only access sessions for venues they have access to
    const { data: existingSession } = await supabase
      .from("table_sessions")
      .select("id")
      .eq("table_id", table.id)
      .eq("venue_id", context.venueId) // Explicit venue check (RLS also enforces this)
      .maybeSingle();

    // Only create session if one doesn't already exist
    if (!existingSession) {

      // RLS ensures user can only create sessions for venues they have access to
      const { error: sessionError } = await supabase.from("table_sessions").insert({
        venue_id: context.venueId,
        table_id: table.id,
        status: "FREE",
        opened_at: new Date().toISOString(),
        closed_at: null,
      });

      if (sessionError) {
        const sessionErrorPayload = {
          venueId: context.venueId,
          userId: context.user?.id,
          tableId: table.id,
          error: sessionError.message,
        };

        return apiErrors.database(
          "Failed to create table session",
          isDevelopment() ? sessionError.message : undefined
        );
      }

    } else { /* Else case handled */ }

    // Success audit log

    // STEP 4: Return success response
    const response = {
      table,
      message: `Table "${table.label}" created successfully!`,
    };

    // Store idempotency key if provided (non-breaking - only if header was sent)
    if (idempotencyKey) {
      const requestHash = JSON.stringify(body);
      await storeIdempotency(
        idempotencyKey,
        requestHash,
        response,
        200,
        3600 // 1 hour TTL
      ).catch(() => {
        // Don't fail request if idempotency storage fails
      });
    }

    return success(response, { timestamp: new Date().toISOString(), requestId }, requestId);
  } catch (error) {

    if (isZodError(error)) {
      return handleZodError(error);
    }

    return apiErrors.internal(
      "Request processing failed",
      isDevelopment() ? error : undefined,
      requestId
    );
  }
});
