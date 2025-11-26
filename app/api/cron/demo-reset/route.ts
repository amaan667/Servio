import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { apiLogger as logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = "force-dynamic";
export const runtime = "edge";

/**
 * Cron job to automatically reset demo data every few hours
 * This endpoint should be called by a cron service (e.g., Vercel Cron, Railway Cron)
 * Uses CRON_SECRET authentication instead of user auth
 */
export async function GET(req: NextRequest) {
  try {
    // STEP 1: Rate limiting (ALWAYS FIRST)
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

    // STEP 2: CRON_SECRET authentication (special auth for cron jobs)
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.CRON_SECRET || "demo-reset-secret";

    if (authHeader !== `Bearer ${expectedSecret}`) {
      logger.warn("[DEMO RESET CRON] Unauthorized cron request", {
        hasHeader: !!authHeader,
        expectedPrefix: "Bearer",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    logger.debug("[DEMO RESET CRON] Completed:", {
      ordersDeleted,
      sessionsDeleted,
      timestamp: new Date().toISOString(),
    });

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
    
    logger.error("[DEMO RESET CRON] Unexpected error:", {
      error: errorMessage,
      stack: errorStack,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run demo reset cron",
        details: errorMessage,
        message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
        ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
      },
      { status: 500 }
    );
  }
}
