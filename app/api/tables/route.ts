import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

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
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit();
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
        logger.error("[TABLES GET] Tables error:", { error: tablesError });
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

      if (sessionsError) {
        logger.error("[TABLES GET] Sessions error:", { error: sessionsError });
        return apiErrors.database(
          "Failed to fetch table sessions",
          isDevelopment() ? sessionsError.message : undefined
        );
      }

      // Combine tables with their sessions
      const tablesWithSessions =
        tables?.map((table: Record<string, unknown>) => {
          const session = sessions?.find((s: Record<string, unknown>) => s.table_id === table.id) as
            | Record<string, unknown>
            | undefined;
          const tableRecord = table as Record<string, unknown>;
          const result = {
            ...tableRecord,
            table_id: tableRecord.id as string, // Add table_id field for consistency with TableRuntimeState interface
            merged_with_table_id: (tableRecord.merged_with_table_id as string | null) || null, // Include merge relationship
            session_id: (session?.id as string | null) || null,
            status: (session?.status as string) || "FREE",
            order_id: (session?.order_id as string | null) || null,
            opened_at: (session?.opened_at as string | null) || null,
            closed_at: (session?.closed_at as string | null) || null,
            total_amount: (session?.total_amount as number | null) || null,
            customer_name: (session?.customer_name as string | null) || null,
            order_status: (session?.order_status as string | null) || null,
            payment_status: (session?.payment_status as string | null) || null,
            order_updated_at: (session?.order_updated_at as string | null) || null,
            reservation_time: (session?.reservation_time as string | null) || null,
            reservation_duration_minutes:
              (session?.reservation_duration_minutes as number | null) || null,
            reservation_end_time: (session?.reservation_end_time as string | null) || null,
            reservation_created_at: (session?.reservation_created_at as string | null) || null,
            most_recent_activity:
              (session?.most_recent_activity as string) || (tableRecord.table_created_at as string),
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

          if (sessionError) {
            logger.error("[TABLES API DEBUG] Error creating session for table:", {
              error: tableId,
              context: sessionError,
            });
          }
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

      return success({ tables: tablesWithSessions });
    } catch (error) {
      logger.error("[TABLES GET] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user?.id,
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

// POST /api/tables - Create a new table
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    // Log route entry (only in development)
    if (isDevelopment()) {
      logger.debug("[TABLES POST] Route hit", {
        url: req.url,
        venueId: context?.venueId,
        userId: context?.user?.id,
      });
    }
    
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Validate input
      const body = await req.json();
      const { label, seat_count, area } = body;

      if (!label) {
        return apiErrors.badRequest("label is required");
      }

      // STEP 3: Business logic
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
        logger.warn("[TABLES POST] Table already exists", { tableId: existingTable.id });
        return apiErrors.badRequest(`Table "${label}" already exists. Please choose a different label.`);
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
        logger.error("[TABLES POST] Error creating table:", {
          error: tableError?.message,
          venueId: context.venueId,
          userId: context.user?.id,
        });
        return apiErrors.database(
          "Failed to create table",
          isDevelopment() ? tableError?.message : undefined
        );
      }

      // Check if session already exists for this table
      logger.debug("[TABLES POST] Step 6: Checking for existing session", { tableId: table.id });
      // RLS ensures user can only access sessions for venues they have access to
      const { data: existingSession } = await supabase
        .from("table_sessions")
        .select("id")
        .eq("table_id", table.id)
        .eq("venue_id", context.venueId) // Explicit venue check (RLS also enforces this)
        .maybeSingle();

      // Only create session if one doesn't already exist
      if (!existingSession) {
        logger.debug("[TABLES POST] Step 7: Creating table session", { tableId: table.id });
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
          logger.error("[TABLES POST] Session creation error", sessionErrorPayload);
          return apiErrors.database(
            "Failed to create table session",
            isDevelopment() ? sessionError.message : undefined
          );
        }
        logger.debug("[TABLES POST] Step 7a: Session created successfully");
      } else {
        logger.debug("[TABLES POST] Step 7: Session already exists, skipping creation");
      }

      // Success audit log
      logger.info("[TABLES POST] Table created successfully", {
        venueId: context.venueId,
        userId: context.user?.id,
        tableId: table.id,
        label: table.label,
        seat_count: table.seat_count,
        area: table.area,
      });

      // STEP 4: Return success response
      return success({
        table,
        message: `Table "${table.label}" created successfully!`,
      });
    } catch (error) {
      logger.error("[TABLES POST] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user?.id,
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
