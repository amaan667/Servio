import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/pay-multiple
 *
 * Pay multiple orders at once (e.g., entire table)
 * Handles both till payment and card payment
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_ids, payment_method, venue_id } = body;

    

    // Validation
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      return NextResponse.json(
        { error: "order_ids array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!payment_method || !["cash", "card", "till"].includes(payment_method)) {
      return NextResponse.json(
        { error: "payment_method must be 'cash', 'card', or 'till'" },
        { status: 400 }
      );
    }

    if (!venue_id) {
      return apiErrors.badRequest("venue_id is required");
    }

    const admin = createAdminClient();

    // Fetch all orders to validate
    const { data: orders, error: fetchError } = await admin
      .from("orders")
      .select("*")
      .in("id", order_ids)
      .eq("venue_id", venue_id);

    if (fetchError || !orders || orders.length === 0) {
      
      return apiErrors.notFound("Orders not found");
    }

    // Validate all orders are unpaid
    const alreadyPaid = orders.filter((o) => o.payment_status === "PAID");
    if (alreadyPaid.length > 0) {
       => o.id) },

      return NextResponse.json(
        {
          error: `Some orders are already paid: ${alreadyPaid.map((o) => o.id.slice(-6)).join(", ")}`,

        },
        { status: 400 }
      );
    }

    // Validate all orders are from same table (optional but recommended)
    const tableNumbers = [...new Set(orders.map((o) => o.table_number).filter(Boolean))];
    if (tableNumbers.length > 1) {
      
      // Allow it but log warning
    }

    // Update all orders to paid
    const { data: updatedOrders, error: updateError } = await admin
      .from("orders")
      .update({

      .in("id", order_ids)
      .eq("venue_id", venue_id)
      .select("*");

    if (updateError) {
      
      return apiErrors.internal("Failed to mark orders as paid");
    }

    // Calculate total
    const totalAmount = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    

    return NextResponse.json({

      totalAmount,

      payment_method,
      message: `Successfully marked ${updatedOrders?.length || 0} order(s) as paid`,

  } catch (_error) {

      },

    return apiErrors.internal("Internal server error");
  }
}
