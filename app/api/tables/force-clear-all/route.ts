import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
import { createAdminClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
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

    const body = await req.json();
    const venue_id = context.venueId || body.venue_id;

    if (!venue_id) {
      return apiErrors.badRequest("venue_id is required");
    }

    const supabase = createAdminClient();

    // Step 1: Force clear ALL table references from orders (including completed ones)
    const { error: clearAllRefsError } = await supabase
      .from("orders")
      .update({ table_id: null })
      .eq("venue_id", venue_id);

    if (clearAllRefsError) {

      return NextResponse.json(
        {
          ok: false,
          error: `Failed to clear table references: ${clearAllRefsError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 2: Delete all table sessions
    const { error: sessionsError } = await supabase
      .from("table_sessions")
      .delete()
      .eq("venue_id", venue_id);

    if (sessionsError) {

      // Continue anyway
    } else {
      // Intentionally empty
    }

    // Step 3: Delete all tables
    const { error: tablesError } = await supabase.from("tables").delete().eq("venue_id", venue_id);

    if (tablesError) {

      return NextResponse.json(
        {
          ok: false,
          error: `Failed to delete tables: ${tablesError.message}`,
        },
        { status: 500 }
      );
    }

    // Step 4: Clear table runtime state
    const { error: runtimeError } = await supabase
      .from("table_runtime_state")
      .delete()
      .eq("venue_id", venue_id);

    if (runtimeError) {

      // Continue anyway
    } else {
      // Intentionally empty
    }

    // Step 5: Clear group sessions
    const { error: groupSessionsError } = await supabase
      .from("table_group_sessions")
      .delete()
      .eq("venue_id", venue_id);

    if (groupSessionsError) {

      // Continue anyway
    } else {
      // Intentionally empty
    }

    return NextResponse.json({
      ok: true,
      message: "All tables and sessions force cleared successfully",
    });
  } catch (_error) {

    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
});
