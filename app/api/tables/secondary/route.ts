import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// GET /api/tables/secondary?primary_table_id=xxx&venue_id=xxx - Find secondary table for a primary table
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
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

      const { searchParams } = new URL(req.url);
      const primaryTableId = searchParams.get("primary_table_id");
      const venueId = context.venueId;

      if (!primaryTableId || !venueId) {
        return NextResponse.json(
          { ok: false, error: "primary_table_id and venue_id are required" },
          { status: 400 }
        );
      }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Find the secondary table that is merged with the primary table
    const { data: secondaryTable, error: secondaryTableError } = await supabase
      .from("tables")
      .select("*")
      .eq("venue_id", venueId)
      .eq("merged_with_table_id", primaryTableId)
      .single();

    if (secondaryTableError) {
      logger.error("[TABLES SECONDARY GET] Error finding secondary table:", secondaryTableError);
      if (secondaryTableError.code === "PGRST116") {
        return NextResponse.json(
          { ok: false, error: "No secondary table found for this primary table" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: false, error: secondaryTableError.message }, { status: 500 });
    }

      return NextResponse.json({
        ok: true,
        table: secondaryTable,
      });
    } catch (_error) {
      logger.error("[TABLES SECONDARY GET] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  }
);
