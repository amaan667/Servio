import { NextRequest, NextResponse } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  routeContext: { params: Promise<{ tableId: string }> }
) {
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        // STEP 1: Rate limiting (ALWAYS FIRST)
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            {
              error: "Too many requests",
              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
            },
            { status: 429 }
          );
        }

        // STEP 2: Get venueId from context (already verified)
        const venueId = authContext.venueId;

        // STEP 3: Parse request
        const { tableId } = await routeContext.params;

        // STEP 4: Validate inputs
        if (!tableId) {
          return apiErrors.badRequest('tableId is required');
        }

        // STEP 5: Security - Verify table belongs to venue
        const adminSupabase = createAdminClient();

        // Get current table to increment qr_version
        const { data: currentTable, error: fetchError } = await adminSupabase
          .from("tables")
          .select("qr_version, venue_id")
          .eq("id", tableId)
          .eq("venue_id", venueId) // Security: ensure table belongs to authenticated venue
          .single();

        if (fetchError || !currentTable) {
          logger.error("[TABLES REISSUE QR] Table not found or venue mismatch:", {
            tableId,
            venueId,
            error: fetchError,
          });
          return NextResponse.json(
            { error: "Table not found or access denied" },
            { status: 404 }
          );
        }

        // STEP 6: Business logic - Increment qr_version
        const { data: table, error } = await adminSupabase
          .from("tables")
          .update({
            qr_version: ((currentTable as { qr_version?: number }).qr_version || 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tableId)
          .eq("venue_id", venueId) // Security: ensure venue matches
          .select()
          .single();

        if (error) {
          logger.error("[TABLES REISSUE QR] Error updating table:", {
            error: error instanceof Error ? error.message : "Unknown error",
            tableId,
            venueId,
            userId: authContext.user.id,
          });
          return NextResponse.json(
            {
              error: "Failed to reissue QR",
              message: isDevelopment() ? error.message : "Database update failed",
            },
            { status: 500 }
          );
        }

        // STEP 7: Return success response
        return NextResponse.json({ table });
      } catch (_error) {
        const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
        const errorStack = _error instanceof Error ? _error.stack : undefined;
        
        logger.error("[TABLES REISSUE QR] Unexpected error:", {
          error: errorMessage,
          stack: errorStack,
          venueId: authContext.venueId,
          userId: authContext.user.id,
        });
        
        if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
          return NextResponse.json(
            {
              error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
              message: errorMessage,
            },
            { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
          );
        }
        
        return NextResponse.json(
          {
            error: "Internal Server Error",
            message: isDevelopment() ? errorMessage : "Request processing failed",
            ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
          },
          { status: 500 }
        );
      }
    },
    {
      // Extract venueId from table lookup
      extractVenueId: async (req) => {
        try {
          // Get tableId from URL path
          const url = new URL(req.url);
          const pathParts = url.pathname.split('/');
          const tableIdIndex = pathParts.indexOf('tables');
          if (tableIdIndex !== -1 && pathParts[tableIdIndex + 1]) {
            const tableId = pathParts[tableIdIndex + 1];
            const { createAdminClient } = await import("@/lib/supabase");
            const admin = createAdminClient();
            const { data: table } = await admin
              .from("tables")
              .select("venue_id")
              .eq("id", tableId)
              .single();
            if (table?.venue_id) {
              return table.venue_id;
            }
          }
          return null;
        } catch {
          return null;
        }
      },
    }
  );
  
  return handler(req, routeContext);
}
