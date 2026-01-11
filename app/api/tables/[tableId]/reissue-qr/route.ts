import { NextRequest, NextResponse } from "next/server";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { createAdminClient } from "@/lib/supabase";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

export async function POST(

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
          return apiErrors.badRequest("tableId is required");
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
          
          return NextResponse.json({ error: "Table not found or access denied" }, { status: 404 });
        }

        // STEP 6: Business logic - Increment qr_version
        const { data: table, error } = await adminSupabase
          .from("tables")
          .update({
            qr_version: ((currentTable as { qr_version?: number }).qr_version || 1) + 1,

          .eq("id", tableId)
          .eq("venue_id", venueId) // Security: ensure venue matches
          .select()
          .single();

        if (error) {
          
          return NextResponse.json(
            {

            },
            { status: 500 }
          );
        }

        // STEP 7: Return success response
        return NextResponse.json({ table });
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
      // Extract venueId from table lookup

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
