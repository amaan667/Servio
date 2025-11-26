import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getUserTier, hasAnalyticsExports } from "@/lib/tier-restrictions";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/inventory/export/csv?venue_id=xxx
// CSV exports require Enterprise tier
export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
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

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;

      // STEP 3: Parse request
      // STEP 4: Validate inputs
      if (!venueId) {
        return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)
      // Check tier - CSV exports require Enterprise tier
      const canExport = await hasAnalyticsExports(context.user.id);
      if (!canExport) {
        const tier = await getUserTier(context.user.id);
        return NextResponse.json(
          {
            error: "CSV exports require Enterprise tier",
            currentTier: tier,
            requiredTier: "enterprise",
          },
          { status: 403 }
        );
      }

      // STEP 6: Business logic
      const supabase = await createClient();

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

      // STEP 7: Return success response
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="inventory-${venueId}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[INVENTORY EXPORT CSV] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        venueId: context.venueId,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from query params
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        return searchParams.get("venue_id") || searchParams.get("venueId");
      } catch {
        return null;
      }
    },
    // CSV exports require Enterprise tier
        requireFeature: "analytics",
  }
);
