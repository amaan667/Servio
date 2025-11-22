import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { getUserTier, hasAnalyticsExports } from "@/lib/tier-restrictions";
import { authenticateRequest } from "@/lib/api-auth";

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

// GET /api/inventory/export/movements?venue_id=xxx&from=&to=&reason=
// CSV exports require Enterprise tier
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const venue_id = searchParams.get("venue_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const reason = searchParams.get("reason");

    if (!venue_id) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

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
      .eq("venue_id", venue_id)
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
        "Content-Disposition": `attachment; filename="movements-${venue_id}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (_error) {
    logger.error("[INVENTORY EXPORT] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
