import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

// GET /api/reservations/unassigned?venueId=xxx - Get unassigned reservations
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

      const venueId = context.venueId;

    // Use admin client - no auth needed (venueId is sufficient)
    const supabase = await createClient();

    // Get unassigned reservations using the view
    const { data: reservations, error } = await supabase
      .from("unassigned_reservations")
      .select("*")
      .eq("venue_id", venueId)
      .order("start_at", { ascending: true });

    if (error) {
      logger.error("[RESERVATIONS UNASSIGNED] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

      return NextResponse.json({
        ok: true,
        reservations: reservations || [],
      });
    } catch (_error) {
      logger.error("[RESERVATIONS UNASSIGNED] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown error",
      });
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  }
);
