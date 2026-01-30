import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { tableService } from "@/lib/services/TableService";
import { createTableSchema } from "@/lib/api/validation-schemas";
import { enforceResourceLimit } from "@/lib/enforce-tier-limits";
import { ApiResponse } from "@/lib/api/standard-response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET: Fetch tables with their current runtime state.
 * Optional pagination: ?limit=50&offset=0 (default limit 500, offset 0; existing clients unchanged).
 */
export const GET = createUnifiedHandler(
  async (req, context) => {
    const limit = Math.min(
      Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "500", 10)),
      500
    );
    const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") || "0", 10));
    const allTables = await tableService.getTablesWithState(context.venueId);
    const tables = allTables.slice(offset, offset + limit);
    return {
      tables,
      pagination: { limit, offset, total: allTables.length },
    };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);

/**
 * POST: Create a new table (with tier limit check)
 */
export const POST = createUnifiedHandler(
  async (req, context) => {
    const { body, venueId, venue } = context;

    // 1. Check Tier Limits (based on venue owner)
    const tables = await tableService.getTables(venueId);
    const limitCheck = await enforceResourceLimit(
      venue.owner_user_id,
      venueId,
      "maxTables",
      tables.length,
      req.headers
    );

    if (!limitCheck.allowed) {
      return limitCheck.response as unknown as NextResponse<ApiResponse<unknown>>;
    }

    // 2. Create Table
    const table = await tableService.createTable(venueId, {
      table_number: parseInt(String(body.table_number), 10) || tables.length + 1,
      label: body.label || String(body.table_number),
      seat_count: body.seat_count || body.capacity || 4,
      section: body.section || body.area || "Main",
    });

    return {
      table,
      message: `Table "${table.label}" created successfully!`,
    };
  },
  {
    requireVenueAccess: true,
    schema: createTableSchema,
    requireRole: ["owner", "manager"],
  }
);
