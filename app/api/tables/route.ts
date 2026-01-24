import { createApiHandler } from "@/lib/api/production-handler";
import { tableService } from "@/lib/services/TableService";
import { createTableSchema } from "@/lib/api/validation-schemas";
import { enforceResourceLimit } from "@/lib/auth/unified-auth";
import { ApiResponse } from "@/lib/api/standard-response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET: Fetch all tables with their current runtime state
 */
export const GET = createApiHandler(
  async (_req, context) => {
    const tables = await tableService.getTablesWithState(context.venueId);
    return { tables };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "query",
  }
);

/**
 * POST: Create a new table (with tier limit check)
 */
export const POST = createApiHandler(
  async (_req, context) => {
    const { body, venueId, venue } = context;

    // 1. Check Tier Limits (based on venue owner)
    const tables = await tableService.getTables(venueId);
    const limitCheck = await enforceResourceLimit(
      venue.owner_user_id, 
      "maxTables", 
      tables.length
    );

    if (!limitCheck.allowed) {
      return limitCheck.response as unknown as NextResponse<ApiResponse<unknown>>;
    }

    // 2. Create Table
    const table = await tableService.createTable(venueId, {
      table_number: parseInt(String(body.table_number), 10) || (tables.length + 1),
      label: body.label || String(body.table_number),
      seat_count: body.seat_count || body.capacity || 4,
      section: body.section || body.area || "Main",
    });

    return { 
      table,
      message: `Table "${table.label}" created successfully!`
    };
  },
  {
    requireVenueAccess: true,
    schema: createTableSchema,
    requireRole: ["owner", "manager"],
  }
);
