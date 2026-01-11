import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/orders/table/[tableNumber]/unpaid-for-payment
 *
 * Fetch all unpaid orders for a specific table for customer payment (QR rescan)
 * This is used when customer rescans QR code to pay for pay_later orders
 * Returns orders in a format suitable for payment screen
 */
export async function GET(

  { params }: { params: Promise<{ tableNumber: string }> }
) {
  try {
    const { tableNumber } = await params;
    const { searchParams } = new URL(_request.url);
    const venueId = searchParams.get("venue_id");
    const parsedTableNumber = z.coerce.number().int().positive().safeParse(tableNumber);

    const rateResult = await rateLimit(_request, RATE_LIMITS.STRICT);
    if (!rateResult.success) {
      return apiErrors.rateLimit(Math.ceil((rateResult.reset - Date.now()) / 1000));
    }

    if (!venueId || !parsedTableNumber.success) {
      return apiErrors.badRequest("venue_id is required");
    }

    const admin = createAdminClient();

    // Fetch all unpaid orders for this table from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        `
        id,
        venue_id,
        table_number,
        customer_name,
        customer_phone,
        customer_email,
        total_amount,
        payment_status,
        payment_mode,
        order_status,
        items,
        created_at
      `
      )
      .eq("venue_id", venueId)
      .eq("table_number", parsedTableNumber.data)
      .in("payment_status", ["UNPAID"])
      .in("payment_mode", ["pay_later", "pay_at_till", "online"])
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      
      return apiErrors.internal("Failed to fetch orders");
    }

    // Calculate total
    const totalAmount = (orders || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);

    // Group by payment mode for display
    const ordersByMode = {

    };

    

    return NextResponse.json({

      totalAmount,

      venueId,

  } catch (_error) {

      },

    return apiErrors.internal("Internal server error");
  }
}
