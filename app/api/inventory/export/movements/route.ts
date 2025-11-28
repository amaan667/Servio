import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getUserTier, hasAnalyticsExports } from "@/lib/tier-restrictions";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';

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
      const { searchParams } = new URL(req.url);
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const reason = searchParams.get("reason");

      // STEP 4: Validate inputs
      if (!venueId) {
        return apiErrors.badRequest('venue_id is required');
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
        logger.error("[INVENTORY EXPORT MOVEMENTS] Error fetching movements:", {
          error: error instanceof Error ? error.message : "Unknown error",
          venueId,
          userId: context.user.id,
        });
        return NextResponse.json(
          {
            error: "Failed to fetch movements",
            message: isDevelopment() ? error.message : "Database query failed",
          },
          { status: 500 }
        );
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

      // STEP 7: Return success response
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="movements-${venueId}-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[INVENTORY EXPORT MOVEMENTS] Unexpected error:", {
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
          message: isDevelopment() ? errorMessage : "Request processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
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
