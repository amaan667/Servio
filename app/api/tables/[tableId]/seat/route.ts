import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody, validateParams } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const seatTableSchema = z.object({
  customerName: z.string().min(1).max(100).optional(),
  partySize: z.number().int().positive().max(50).optional(),
});

const tableIdParamSchema = z.object({
  tableId: z.string().uuid("Invalid table ID"),
});

// POST /api/tables/[tableId]/seat - Seat a party at a table
export async function POST(req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext, routeParams) => {
      try {
        // STEP 1: Rate limiting (ALWAYS FIRST)
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
        }

        // STEP 2: Validate params and body
        const params = await routeParams!.params!;
        const validatedParams = validateParams(tableIdParamSchema, params);
        const body = await validateBody(seatTableSchema, await req.json().catch(() => ({})));

        // STEP 3: Business logic
        const adminSupabase = createAdminClient();

        // Get table to verify it exists and get venue_id
        const { data: table, error: tableError } = await adminSupabase
          .from("tables")
          .select("id, venue_id, label, capacity")
          .eq("id", validatedParams.tableId)
          .single();

        if (tableError || !table) {
          return apiErrors.notFound("Table not found");
        }

        // Verify venue access
        if (table.venue_id !== authContext.venueId) {
          return apiErrors.forbidden("Table does not belong to your venue");
        }

        // Create or update table session
        const { data: session, error: sessionError } = await adminSupabase
          .from("table_sessions")
          .upsert(
            {
              table_id: validatedParams.tableId,
              venue_id: table.venue_id,
              customer_name: body.customerName || null,
              party_size: body.partySize || null,
              status: "OPEN",
              opened_at: new Date().toISOString(),
            },
            {
              onConflict: "table_id",
            }
          )
          .select()
          .single();

        if (sessionError) {
          logger.error("[TABLES SEAT] Error creating session:", {
            error: sessionError.message,
            tableId: validatedParams.tableId,
            venueId: authContext.venueId,
            userId: authContext.user.id,
          });
          return apiErrors.database(
            "Failed to seat party",
            isDevelopment() ? sessionError.message : undefined
          );
        }

        logger.info("[TABLES SEAT] Party seated successfully", {
          tableId: validatedParams.tableId,
          venueId: authContext.venueId,
          userId: authContext.user.id,
        });

        // STEP 4: Return success response
        return success({
          session,
          table,
        });
      } catch (error) {
        logger.error("[TABLES SEAT] Unexpected error:", {
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

  return handler(req, context);
}
