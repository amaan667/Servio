import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

import { env, isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";

export const dynamic = "force-dynamic";
export const runtime = "edge";

/**
 * Cron job to automatically reset demo data every few hours
 * This endpoint should be called by a cron service (e.g., Vercel Cron, Railway Cron)
 * Uses CRON_SECRET authentication instead of user auth
 * Note: Rate limiting skipped for Edge runtime (CRON_SECRET provides sufficient protection)
 */
export async function GET(req: NextRequest) {
  try {
    // STEP 1: CRON_SECRET authentication (special auth for cron jobs)
    const authHeader = req.headers.get("authorization");
    const expectedSecret = env("CRON_SECRET") || "demo-reset-secret";

    if (authHeader !== `Bearer ${expectedSecret}`) {

      return apiErrors.unauthorized("Unauthorized");
    }

    // STEP 3: Parse request
    // STEP 4: Validate inputs (none required)

    // STEP 5: Security - CRON_SECRET verified above

    // STEP 6: Business logic
    const supabase = await createClient();
    const demoVenueId = "demo-cafe";

    // Delete demo orders older than 3 hours
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: deletedOrders, error: ordersError } = await supabase
      .from("orders")
      .delete()
      .eq("venue_id", demoVenueId)
      .lt("created_at", threeHoursAgo)
      .select("id");

    const ordersDeleted = deletedOrders?.length || 0;

    // Delete demo table sessions older than 3 hours
    const { data: deletedSessions, error: sessionsError } = await supabase
      .from("table_sessions")
      .delete()
      .eq("venue_id", demoVenueId)
      .lt("created_at", threeHoursAgo)
      .select("id");

    const sessionsDeleted = deletedSessions?.length || 0;

    // STEP 7: Return success response
    return NextResponse.json({
      success: true,
      ordersDeleted,
      sessionsDeleted,
      timestamp: new Date().toISOString(),
      errors: {
        orders: ordersError?.message || null,
        sessions: sessionsError?.message || null,
      },
    });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
    const errorStack = _error instanceof Error ? _error.stack : undefined;

    return NextResponse.json(
      {
        success: false,
        error: "Failed to run demo reset cron",
        details: errorMessage,
        message: isDevelopment() ? errorMessage : "Request processing failed",
        ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
      },
      { status: 500 }
    );
  }
}
