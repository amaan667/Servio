import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";
import { enforceResourceLimit } from "@/lib/enforce-tier-limits";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

interface TableRow {
  id: string;
  table_id?: string;
  table_number?: number;
  label?: string;
  [key: string]: unknown;
}

// GET /api/tables?venueId=xxx - Get table runtime state for a venue
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id") || searchParams.get("venueId");

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venueId required" }, { status: 400 });
    }

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { ok: false, error: auth.error || "Not authenticated" },
        { status: 401 }
      );
    }

    const { user, supabase } = auth;

    // Check venue ownership
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Get tables with their current sessions using a simpler approach
    // Only show primary tables (filter out secondary tables that are merged into others)
    const { data: tables, error: tablesError } = await supabase
      .from("tables")
      .select("*")
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .is("merged_with_table_id", null) // Only show tables that are not merged into another table
      .order("label");

    if (tablesError) {
      logger.error("[TABLES GET] Tables error:", { value: tablesError });
      return NextResponse.json({ ok: false, error: tablesError.message }, { status: 500 });
    }

    // Get current sessions for each table (only active sessions)
    const { data: sessions, error: sessionsError } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("venue_id", venueId)
      .in("table_id", (tables as unknown as TableRow[])?.map((t) => t.id) || [])
      .is("closed_at", null); // Only get active sessions

    if (sessionsError) {
      logger.error("[TABLES GET] Sessions error:", { value: sessionsError });
      return NextResponse.json({ ok: false, error: sessionsError.message }, { status: 500 });
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
    const adminSupabase = createAdminClient();
    const tablesWithoutSessions = tablesWithSessions.filter((t) => !t.session_id);

    if (tablesWithoutSessions.length > 0) {
      for (const table of tablesWithoutSessions) {
        const tableWithId = table as { table_id?: string; id?: string };
        const tableId = tableWithId.table_id || tableWithId.id;
        const { error: sessionError } = await adminSupabase.from("table_sessions").insert({
          venue_id: venueId,
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
      const { data: updatedSessions } = await adminSupabase
        .from("table_sessions")
        .select("*")
        .eq("venue_id", venueId)
        .in("table_id", (tables as unknown as TableRow[])?.map((t) => t.id) || [])
        .is("closed_at", null);

      // Update the tables with the new sessions
      tablesWithSessions.forEach((table) => {
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

    return NextResponse.json({
      ok: true,
      tables: tablesWithSessions,
    });
  } catch (_error) {
    logger.error("[TABLES GET] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/tables - Create a new table
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { venue_id, label, seat_count, area } = body;

    if (!venue_id || !label) {
      return NextResponse.json(
        { ok: false, error: "venue_id and label are required" },
        { status: 400 }
      );
    }

    // Authenticate using Authorization header
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { ok: false, error: auth.error || "Not authenticated" },
        { status: 401 }
      );
    }

    const { user, supabase } = auth;
    const adminSupabase = createAdminClient();

    // Verify venue access
    const access = await verifyVenueAccess(supabase, user.id, venue_id);
    if (!access.hasAccess) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Check if a table with the same label already exists
    const { data: existingTable } = await adminSupabase
      .from("tables")
      .select("id, label")
      .eq("venue_id", venue_id)
      .eq("label", label)
      .eq("is_active", true)
      .maybeSingle();

    if (existingTable) {
      return NextResponse.json(
        {
          ok: false,
          error: `Table "${label}" already exists. Please choose a different label.`,
        },
        { status: 400 }
      );
    }

    // Check if there are unknown active orders for a table with the same label
    // This handles cases where the table might have been deleted but orders still exist
    const { data: activeOrders } = await adminSupabase
      .from("orders")
      .select("id, table_number, customer_name, order_status")
      .eq("venue_id", venue_id)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "OUT_FOR_DELIVERY", "SERVING"])
      .not("table_number", "is", null);

    // Check if unknown active orders have a table number that matches the label
    const tableNumber = parseInt(label.replace(/\D/g, "")); // Extract number from label
    const hasActiveOrders = activeOrders?.some((order) => {
      // Check if the order's table number matches the extracted number from the label
      return order.table_number === tableNumber;
    });

    if (hasActiveOrders) {
      return NextResponse.json(
        {
          ok: false,
          error: `Cannot create table "${label}" - there are active orders for this table. Please complete or cancel the existing orders first.`,
        },
        { status: 400 }
      );
    }

    // Check tier limits before creating table
    const { data: currentTables } = await adminSupabase
      .from("tables")
      .select("id", { count: "exact" })
      .eq("venue_id", venue_id)
      .eq("is_active", true);

    const currentCount = currentTables?.length || 0;
    const tierCheck = await enforceResourceLimit(user.id, venue_id, "maxTables", currentCount + 1);

    if (!tierCheck.allowed && tierCheck.response) {
      return tierCheck.response;
    }

    // Create table using admin client to bypass RLS
    const { data: table, error: tableError } = await adminSupabase
      .from("tables")
      .insert({
        venue_id: venue_id,
        label: label,
        seat_count: seat_count || 2,
        area: area || null,
        is_active: true, // Explicitly set as active for counting
      })
      .select()
      .single();

    if (tableError) {
      logger.error("[TABLES POST] Table creation error:", {
        error: tableError instanceof Error ? tableError.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: tableError.message }, { status: 500 });
    }

    // Check if session already exists for this table
    const { data: existingSession } = await adminSupabase
      .from("table_sessions")
      .select("id")
      .eq("table_id", table.id)
      .eq("venue_id", venue_id)
      .maybeSingle();

    // Only create session if one doesn't already exist
    if (!existingSession) {
      const { error: sessionError } = await adminSupabase.from("table_sessions").insert({
        venue_id: venue_id,
        table_id: table.id,
        status: "FREE",
        opened_at: new Date().toISOString(),
        closed_at: null,
      });

      if (sessionError) {
        logger.error("[TABLES POST] Session creation error:", { value: sessionError });
        return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      table: table,
      message: `Table "${label}" created successfully!`,
    });
  } catch (_error) {
    logger.error("[TABLES POST] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
