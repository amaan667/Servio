import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

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

      // Clear all menu items for this venue
      const { error: clearError } = await adminSupabase
        .from("menu_items")
        .delete()
        .eq("venue_id", context.venueId);

      if (clearError) {
        logger.error("[CATALOG CLEAR] Error clearing menu items:", { value: clearError });
        return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, message: "All menu items cleared" });
    } catch (_error) {
      logger.error("[CATALOG CLEAR] Unexpected error:", {
        error: _error instanceof Error ? _error.message : "Unknown _error",
      });
      return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
    }
  }
);
