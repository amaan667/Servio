import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getUserTier, hasAnalyticsExports } from "@/lib/tier-restrictions";
import { authenticateRequest } from "@/lib/api-auth";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface StockMovement {
  created_at: string;
  delta: number;
  reason: string;
  ref_type?: string;
  note?: string;
  ingredient?: {
    name: string;
    unit: string;
  };
  user?: {
    email: string;
  };
}

// GET /api/inventory/export/movements?venueId=xxx&from=&to=&reason=
// CSV exports require Enterprise tier
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id") || searchParams.get("venueId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const reason = searchParams.get("reason");

    if (!venueId) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

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

    // Get authenticated user for tier check
    const auth = await authenticateRequest(req);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Check tier - CSV exports require Enterprise tier
    const canExport = await hasAnalyticsExports(auth.user.id);
    if (!canExport) {
      const tier = await getUserTier(auth.user.id);
      return NextResponse.json(
        {
          error: "CSV exports require Enterprise tier",
          currentTier: tier,
          requiredTier: "enterprise",
        },
        { status: 403 }
      );
    }

    let query = supabase
      .from("stock_ledgers")
      .select(
        `
        *,
        ingredient:ingredients(name, unit),
        user:created_by(email)
      `
      )
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false });

    if (reason && reason !== "all") {
      query = query.eq("reason", reason);
    }

    if (from) {
      query = query.gte("created_at", from);
    }

    if (to) {
      query = query.lte("created_at", to);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("[INVENTORY EXPORT] Error fetching movements:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate CSV
    const headers = ["Date", "Ingredient", "Delta", "Unit", "Reason", "Ref Type", "Note", "User"];
    const rows =
      data?.map((movement: StockMovement) => [
        new Date(movement.created_at).toISOString(),
        movement.ingredient?.name || "Unknown",
        movement.delta,
        movement.ingredient?.unit || "",
        movement.reason,
        movement.ref_type || "",
        movement.note || "",
        movement.user?.email || "System",
      ]) || [];

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="movements-${venueId}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (_error) {
    logger.error("[INVENTORY EXPORT] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
