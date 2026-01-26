import { NextRequest } from "next/server";
import { success, apiErrors } from "@/lib/api/standard-response";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";

const forceClearAllSchema = z.object({
  venue_id: z.string().optional(),
  venueId: z.string().optional(),
});

export const POST = createUnifiedHandler(async (_req: NextRequest, context) => {
  const { body } = context;
  const venue_id = context.venueId || body.venue_id || body.venueId;

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
      return apiErrors.database(`Failed to clear table references: ${clearAllRefsError.message}`);
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
      return apiErrors.database(`Failed to delete tables: ${tablesError.message}`);
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

    return success({
      ok: true,
      message: "All tables and sessions force cleared successfully",
    });
  },
  {
    schema: forceClearAllSchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const body = await req.clone().json().catch(() => ({}));
        return (
          (body as { venue_id?: string; venueId?: string })?.venue_id ||
          (body as { venue_id?: string; venueId?: string })?.venueId ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);
