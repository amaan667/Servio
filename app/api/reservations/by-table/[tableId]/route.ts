import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  routeContext: { params: Promise<{ tableId: string }> }
) {
  // Wrap with withUnifiedAuth - need to extract venueId from table
  const handler = withUnifiedAuth(
    async (req: NextRequest, authContext) => {
      try {
        // CRITICAL: Rate limiting
        const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
        if (!rateLimitResult.success) {
          return NextResponse.json(
            {
              error: 'Too many requests',
              message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
            },
            { status: 429 }
          );
        }

        const { tableId } = await routeContext.params;

        if (!tableId) {
          return NextResponse.json(
            {
              ok: false,
              error: "tableId is required",
            },
            { status: 400 }
          );
        }

        // Use admin client
        const supabase = createAdminClient();

        // Verify table belongs to authenticated venue (security check)
        const { data: table, error: tableError } = await supabase
          .from("tables")
          .select("venue_id")
          .eq("id", tableId)
          .eq("venue_id", authContext.venueId)
          .single();

        if (tableError || !table) {
          logger.error("[GET RESERVATION BY TABLE] Table not found or venue mismatch:", {
            tableId,
            venueId: authContext.venueId,
            error: tableError,
          });
          return NextResponse.json(
            {
              ok: false,
              error: "Table not found or access denied",
            },
            { status: 404 }
          );
        }

        // Get the reservation for this table
        const { data: reservation, error: reservationError } = await supabase
          .from("reservations")
          .select("*")
          .eq("table_id", tableId)
          .eq("venue_id", authContext.venueId) // Security: ensure reservation belongs to venue
          .in("status", ["BOOKED", "CHECKED_IN"])
          .order("start_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (reservationError) {
          logger.error("[GET RESERVATION BY TABLE] Error fetching reservation:", {
            tableId,
            venueId: authContext.venueId,
            error: reservationError,
          });
          return NextResponse.json(
            {
              ok: false,
              error: "Failed to fetch reservation",
              message: process.env.NODE_ENV === "development" ? reservationError.message : "Database query failed",
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          reservation: reservation || null,
        });
      } catch (_error) {
        const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
        const errorStack = _error instanceof Error ? _error.stack : undefined;
        
        logger.error("[GET RESERVATION BY TABLE] Unexpected error:", {
          error: errorMessage,
          stack: errorStack,
        });
        
        // Check if it's an authentication/authorization error
        if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
          return NextResponse.json(
            {
              ok: false,
              error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
              message: errorMessage,
            },
            { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
          );
        }
        
        return NextResponse.json(
          {
            ok: false,
            error: "Internal Server Error",
            message: process.env.NODE_ENV === "development" ? errorMessage : "Failed to fetch reservation",
            ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
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
          const tableIdIndex = pathParts.indexOf('by-table');
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
  
  return handler(_req, routeContext);
}
