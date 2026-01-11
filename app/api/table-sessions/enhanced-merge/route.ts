import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { getTableState, getMergeScenario } from "@/lib/table-states";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {

            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      const body = await req.json();
      const { source_table_id, target_table_id, confirmed = false } = body;

      // STEP 4: Validate inputs
      if (!source_table_id || !target_table_id || !venueId) {
        return NextResponse.json(
          {
            error: "source_table_id, target_table_id, and venue_id are required",
          },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)
      // Get both tables with their current state
      const supabase = createAdminClient();
      const { data: tables, error: tablesError } = await supabase
        .from("tables")
        .select(
          `
        *,
        table_sessions!left (
          id,
          status,
          order_id,
          opened_at,
          closed_at,
          customer_name,
          total_amount,
          reservation_time
        )
      `
        )
        .in("id", [source_table_id, target_table_id])
        .eq("venue_id", venueId);

      if (tablesError || !tables || tables.length !== 2) {
        return apiErrors.notFound("Tables not found");
      }

      const sourceTable = tables.find((t: { id: string }) => t.id === source_table_id);
      const targetTable = tables.find((t: { id: string }) => t.id === target_table_id);

      if (!sourceTable || !targetTable) {
        return apiErrors.notFound("One or both tables not found");
      }

      // Get table states and merge scenario
      const sourceState = getTableState(sourceTable);
      getTableState(targetTable); // targetState calculated but not used yet
      const mergeScenario = getMergeScenario(sourceTable, targetTable);

      // Validate merge scenario
      if (!mergeScenario.allowed) {
        return NextResponse.json(
          {

          },
          { status: 400 }
        );
      }

      // Check if confirmation is required but not provided
      if (mergeScenario.requiresConfirmation && !confirmed) {
        return NextResponse.json(
          {

          },
          { status: 400 }
        );
      }

      // Perform the merge based on scenario type
      let result;
      switch (mergeScenario.type) {
        case "FREE_FREE":
          result = await mergeFreeTables(supabase, sourceTable, targetTable);
          break;
        case "FREE_OCCUPIED":
          result = await expandOccupiedTable(
            supabase,
            sourceTable,
            targetTable,
            sourceState.state === "FREE"
          );
          break;
        case "FREE_RESERVED":
          result = await expandReservedTable(
            supabase,
            sourceTable,
            targetTable,
            sourceState.state === "FREE"
          );
          break;
        case "OCCUPIED_OCCUPIED":
          result = await mergeOccupiedTables(supabase, sourceTable, targetTable);
          break;
        case "RESERVED_RESERVED":
          result = await mergeReservedTables(supabase, sourceTable, targetTable);
          break;

      }

      if (result.error) {
        
        return NextResponse.json(
          {

          },
          { status: 500 }
        );
      }

      // STEP 7: Return success response
      return NextResponse.json({

    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {

          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {

          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body

      } catch {
        return null;
      }
    },
  }
);

/**
 * Merge two free tables
 */
async function mergeFreeTables(

  sourceTable: { id: string; label: string; seat_count: number; venue_id: string },
  targetTable: { id: string; label: string; seat_count: number }
) {
  try {
    // Create a new combined session for both tables
    const combinedLabel = `${sourceTable.label} + ${targetTable.label}`;

    // Update source table to be the primary
    const { error: sourceError } = await supabase
      .from("tables")
      .update({

      .eq("id", sourceTable.id);

    if (sourceError) {
      return { error: "Failed to update source table" };
    }

    // Mark target table as merged with source
    const { error: targetError } = await supabase
      .from("tables")
      .update({

      .eq("id", targetTable.id);

    if (targetError) {
      return { error: "Failed to update target table" };
    }

    // Create a new FREE session for the combined table
    const { error: sessionError } = await supabase.from("table_sessions").insert({

    if (sessionError) {
      return { error: "Failed to create combined session" };
    }

    return {

        merged_tables: [sourceTable.id, targetTable.id],

      },
    };
  } catch (_error) {
    
    return { error: "Failed to merge free tables" };
  }
}

/**
 * Expand occupied table with free table
 */
async function expandOccupiedTable(

  sourceTable: { id: string; seat_count: number; venue_id: string; label: string },
  targetTable: { id: string; seat_count: number; venue_id: string; label: string },

    const { data: occupiedSession, error: sessionError } = await supabase
      .from("table_sessions")
      .select("*")
      .eq("table_id", occupiedTable.id)
      .is("closed_at", null)
      .single();

    if (sessionError || !occupiedSession) {
      return { error: "No active session found for occupied table" };
    }

    // Update occupied table label to include the free table
    const newLabel = `${occupiedTable.label} + ${freeTable.label}`;
    const { error: labelError } = await supabase
      .from("tables")
      .update({

      .eq("id", occupiedTable.id);

    if (labelError) {
      return { error: "Failed to update occupied table label" };
    }

    // Mark free table as merged with occupied table
    const { error: mergeError } = await supabase
      .from("tables")
      .update({

      .eq("id", freeTable.id);

    if (mergeError) {
      return { error: "Failed to merge free table" };
    }

    return {

      },
    };
  } catch (_error) {
    
    return { error: "Failed to expand occupied table" };
  }
}

/**
 * Expand reserved table with free table
 */
async function expandReservedTable(

  sourceTable: { id: string; seat_count: number; venue_id: string; label: string },
  targetTable: { id: string; seat_count: number; venue_id: string; label: string },

    const newLabel = `${reservedTable.label} + ${freeTable.label}`;
    const { error: labelError } = await supabase
      .from("tables")
      .update({

      .eq("id", reservedTable.id);

    if (labelError) {
      return { error: "Failed to update reserved table label" };
    }

    // Mark free table as merged with reserved table
    const { error: mergeError } = await supabase
      .from("tables")
      .update({

      .eq("id", freeTable.id);

    if (mergeError) {
      return { error: "Failed to merge free table" };
    }

    return {

      },
    };
  } catch (_error) {
    
    return { error: "Failed to expand reserved table" };
  }
}

/**
 * Merge two occupied tables (risky operation)
 */
async function mergeOccupiedTables(

  sourceTable: { id: string; seat_count: number; venue_id: string; label: string },
  targetTable: { id: string; seat_count: number; venue_id: string; label: string }
) {
  try {
    // Get both sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("table_sessions")
      .select("*")
      .in("table_id", [sourceTable.id, targetTable.id])
      .is("closed_at", null);

    if (sessionsError || !sessions || sessions.length !== 2) {
      return { error: "Could not find both active sessions" };
    }

    interface SessionRow {

    }
    const sourceSession = (sessions as unknown as SessionRow[]).find(
      (s) => s.table_id === sourceTable.id
    );
    const targetSession = (sessions as unknown as SessionRow[]).find(
      (s) => s.table_id === targetTable.id
    );

    if (!sourceSession || !targetSession) {
      return { error: "Could not find both active sessions" };
    }

    // Choose primary session (use source as primary)
    const primarySession = sourceSession;
    const secondarySession = targetSession;

    // Combine outstanding amounts
    const combinedTotal = (primarySession.total_amount || 0) + (secondarySession.total_amount || 0);

    // Update primary session with combined data
    const { error: primaryError } = await supabase
      .from("table_sessions")
      .update({

      .eq("id", primarySession.id);

    if (primaryError) {
      return { error: "Failed to update primary session" };
    }

    // Close secondary session
    const { error: closeError } = await supabase
      .from("table_sessions")
      .update({

      .eq("id", secondarySession.id);

    if (closeError) {
      return { error: "Failed to close secondary session" };
    }

    // Update table labels
    const combinedLabel = `${sourceTable.label} + ${targetTable.label}`;

    const { error: sourceLabelError } = await supabase
      .from("tables")
      .update({

      .eq("id", sourceTable.id);

    if (sourceLabelError) {
      return { error: "Failed to update source table label" };
    }

    const { error: targetMergeError } = await supabase
      .from("tables")
      .update({

      .eq("id", targetTable.id);

    if (targetMergeError) {
      return { error: "Failed to merge target table" };
    }

    return {

      },
    };
  } catch (_error) {
    
    return { error: "Failed to merge occupied tables" };
  }
}

/**
 * Merge two reserved tables (same reservation only)
 */
async function mergeReservedTables(

  sourceTable: { id: string; seat_count: number; venue_id: string; label: string },
  targetTable: { id: string; seat_count: number; venue_id: string; label: string }
) {
  try {
    // Update table labels
    const combinedLabel = `${sourceTable.label} + ${targetTable.label}`;

    const { error: sourceLabelError } = await supabase
      .from("tables")
      .update({

      .eq("id", sourceTable.id);

    if (sourceLabelError) {
      return { error: "Failed to update source table label" };
    }

    const { error: targetMergeError } = await supabase
      .from("tables")
      .update({

      .eq("id", targetTable.id);

    if (targetMergeError) {
      return { error: "Failed to merge target table" };
    }

    return {

      },
    };
  } catch (_error) {
    
    return { error: "Failed to merge reserved tables" };
  }
}
