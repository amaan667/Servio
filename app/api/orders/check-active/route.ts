import { NextResponse } from "next/server";
import { apiErrors } from '@/lib/api/standard-response';
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Check for active unpaid orders for a table
 * Uses service role to bypass RLS - customers don't need auth to check their orders
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    const tableNumber = searchParams.get("tableNumber");

    logger.info("🔍 [CHECK ACTIVE ORDERS] API called", {
      venueId,
      tableNumber,
      timestamp: new Date().toISOString(),
    });

    if (!venueId || !tableNumber) {
      return NextResponse.json(
        { ok: false, error: "venueId and tableNumber are required" },
        { status: 400 }
      );
    }

    // Use service role to bypass RLS (customers don't need to be authenticated)
    const supabase = createClient(
      env('NEXT_PUBLIC_SUPABASE_URL')!,
      env('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    logger.info("📊 [CHECK ACTIVE ORDERS] Querying database", {
      venueId,
      tableNumber,
    });

    const { data: activeOrders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venueId)
      .eq("table_number", tableNumber)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "OUT_FOR_DELIVERY", "SERVING"])
      .in("payment_status", ["UNPAID", "IN_PROGRESS"]);

    if (error) {
      logger.error("❌ [CHECK ACTIVE ORDERS] Database error", {
        venueId,
        tableNumber,
        error: error.message,
        code: error.code,
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    logger.info("✅ [CHECK ACTIVE ORDERS] Query successful", {
      venueId,
      tableNumber,
      count: activeOrders?.length || 0,
    });

    return NextResponse.json({
      ok: true,
      orders: activeOrders || [],
    });
  } catch (_error) {
    logger.error("❌ [CHECK ACTIVE ORDERS] Unexpected error", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
    return apiErrors.internal('Internal server error');
  }
}
