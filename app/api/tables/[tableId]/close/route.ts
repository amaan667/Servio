import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";
import { handleCloseTable } from "@/app/api/table-sessions/handlers/table-action-handlers";

export const runtime = "nodejs";

const tableIdParamSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

// POST /api/tables/[tableId]/close - Close a table
type TableParams = { params?: Promise<{ tableId?: string }> };

export async function POST(req: NextRequest, context: TableParams = {}) {
  const handler = createUnifiedHandler(
    async (_req: NextRequest, handlerContext) => {
      // Get tableId from route params (handled by unified handler)
      const tableId = handlerContext.params?.tableId;

      if (!tableId) {
        return apiErrors.badRequest("tableId is required");
      }

      // Get venueId from context (already verified)
      const venueId = handlerContext.venueId;

      if (!venueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // Business logic
      const supabase = createAdminClient();

      // Verify table belongs to venue
      const { data: table, error: tableError } = await supabase
        .from("tables")
        .select("venue_id")
        .eq("id", tableId)
        .eq("venue_id", venueId)
        .single();

      if (tableError || !table) {
        return apiErrors.notFound("Table not found or access denied");
      }

      // Use the handler function
      const result = await handleCloseTable(supabase, tableId);

      return success(result);
    },
    {
      requireVenueAccess: true,
      rateLimit: RATE_LIMITS.GENERAL,
      extractVenueId: async (req, routeContext) => {
        // Get venueId from table record
        if (routeContext?.params) {
          const params =
            routeContext.params instanceof Promise
              ? await routeContext.params
              : routeContext.params;
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

  return handler(req, context as { params?: Promise<Record<string, string>> });
}
