import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getUserTier, hasAnalyticsExports } from "@/lib/tier-restrictions";
import { authenticateRequest } from "@/lib/api-auth";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/inventory/export/csv?venue_id=xxx
// CSV exports require Enterprise tier
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id") || searchParams.get("venueId");

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

    // Fetch all ingredients with stock levels
    const { data, error } = await supabase
      .from("v_stock_levels")
      .select("*")
      .eq("venue_id", venueId)
      .order("name", { ascending: true });

    if (error) {
      logger.error("[INVENTORY API] Error fetching ingredients for export:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate CSV
    const headers = [
      "Name",
      "SKU",
      "Unit",
      "Cost Per Unit",
      "On Hand",
      "Par Level",
      "Reorder Level",
      "Supplier",
    ];

    const csvRows = [
      headers.join(","),
      ...(data || []).map((item) =>
        [
          `"${item.name || ""}"`,
          `"${item.sku || ""}"`,
          item.unit || "",
          item.cost_per_unit || 0,
          item.on_hand || 0,
          item.par_level || 0,
          item.reorder_level || 0,
          `"${item.supplier || ""}"`,
        ].join(",")
      ),
    ];

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="inventory-${venueId}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (_error) {
    logger.error("[INVENTORY API] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
