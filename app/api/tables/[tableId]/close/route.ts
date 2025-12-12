import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateParams } from "@/lib/api/validation-schemas";
import { handleCloseTable } from "@/app/api/table-sessions/handlers/table-action-handlers";

export const runtime = "nodejs";

const tableIdParamSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

// POST /api/tables/[tableId]/close - Close a table
type TableParams = { params?: { tableId?: string } };

export async function POST(req: NextRequest, context: TableParams = {}) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext, routeParams) => {
      try {
        // STEP 1: Rate limiting (ALWAYS FIRST)
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
        }

        // STEP 2: Validate params
        const params = routeParams?.params ?? {};
        const validatedParams = validateParams(tableIdParamSchema, params);

        // STEP 3: Business logic
        const supabase = createAdminClient();

        // Verify table belongs to venue
        const { data: table, error: tableError } = await supabase
          .from("tables")
          .select("venue_id")
          .eq("id", validatedParams.tableId)
          .eq("venue_id", authContext.venueId)
          .single();

        if (tableError || !table) {
          logger.warn("[TABLES CLOSE] Table not found", {
            tableId: validatedParams.tableId,
            venueId: authContext.venueId,
            userId: authContext.user.id,
          });
          return apiErrors.notFound("Table not found or access denied");
        }

        // Use the handler function
        const result = await handleCloseTable(supabase, validatedParams.tableId);

        logger.info("[TABLES CLOSE] Table closed successfully", {
          tableId: validatedParams.tableId,
          venueId: authContext.venueId,
          userId: authContext.user.id,
        });

        // STEP 4: Return success response
        return success(result);
      } catch (error) {
        logger.error("[TABLES CLOSE] Unexpected error:", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          userId: authContext.user.id,
        });

        if (isZodError(error)) {
          return handleZodError(error);
        }

        return apiErrors.internal("Request processing failed", isDevelopment() ? error : undefined);
      }
    },
    {
      extractVenueId: async (req, routeParams) => {
        // Get venueId from table record
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
