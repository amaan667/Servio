import { success, apiErrors } from "@/lib/api/standard-response";
import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

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

    if (!venueId || !tableNumber) {
      return apiErrors.badRequest("venueId and tableNumber are required");
    }

    // Use service role to bypass RLS (customers don't need to be authenticated)
    const supabase = createClient(
      env("NEXT_PUBLIC_SUPABASE_URL")!,
      env("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: activeOrders, error } = await supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venueId)
      .eq("table_number", tableNumber)
      .in("order_status", ["PLACED", "ACCEPTED", "IN_PREP", "READY", "OUT_FOR_DELIVERY", "SERVING"])
      .in("payment_status", ["UNPAID", "IN_PROGRESS"]);

    if (error) {

      return apiErrors.database(error.message);
    }

    return success({
      orders: activeOrders || [],
    });
  } catch (_error) {

    return apiErrors.internal("Internal server error");
  }
}
