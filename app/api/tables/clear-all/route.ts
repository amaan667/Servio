import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NUCLEAR OPTION: Clear ALL table sessions for a venue
 * Call: POST /api/tables/clear-all
 * Body: { "venueId": "venue-1e02af4d" }
 */
export const POST = withUnifiedAuth(
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

      const adminSupabase = createAdminClient();

      // Clear all table sessions
      const { error: clearSessionsError } = await adminSupabase
        .from("table_sessions")
        .delete()
        .eq("venue_id", context.venueId);

      if (clearSessionsError) {
        logger.error("[TABLES CLEAR ALL] Error clearing sessions:", { value: clearSessionsError });
        return NextResponse.json(
          { ok: false, error: clearSessionsError.message },
          { status: 500 }
        );
      }

      // Clear all group sessions
      const { error: clearGroupSessionsError } = await adminSupabase
        .from("table_group_sessions")
        .delete()
        .eq("venue_id", context.venueId);

      if (clearGroupSessionsError) {
        logger.error("[TABLES CLEAR ALL] Error clearing group sessions:", {
          value: clearGroupSessionsError,
        });
        return NextResponse.json(
          { ok: false, error: clearGroupSessionsError.message },
          { status: 500 }
        );
      }

      logger.info(`[TABLES CLEAR ALL] Successfully cleared all sessions for venue ${context.venueId}`);

      return NextResponse.json({
        ok: true,
        message: "All table sessions and group sessions cleared successfully",
      });
    } catch (_error) {
      logger.error("[TABLES CLEAR ALL] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  }
);
