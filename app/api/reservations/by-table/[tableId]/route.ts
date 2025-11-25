import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: { params: Promise<{ tableId: string }> }) {
  try {
    const req = _req;

    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI(req);
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
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

    const { tableId } = await context.params;

    if (!tableId) {
      return NextResponse.json(
        {
          ok: false,
          error: "tableId is required",
        },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const supabase = createAdminClient();

    // Get the reservation for this table
    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("*")
      .eq("table_id", tableId)
      .in("status", ["BOOKED", "CHECKED_IN"])
      .order("start_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (reservationError) {
      logger.error("[GET RESERVATION BY TABLE] Error fetching reservation:", reservationError);
      return NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch reservation",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      reservation: reservation || null,
    });
  } catch (_error) {
    logger.error("[GET RESERVATION BY TABLE] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Internal server _error",
      },
      { status: 500 }
    );
  }
}
