import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderParams = { params?: { orderId?: string } };

export async function GET(_req: Request, context: OrderParams = {}) {
  try {
    const supabaseAdmin = createAdminClient();
    const orderId = context.params?.orderId;

    if (!orderId) {
      return apiErrors.badRequest("Order ID is required");
    }

    // Fetch order with items (items are stored as JSONB in orders table)
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

     : "N/A" },

    if (orderError) {
      
      
      return NextResponse.json(
        {

        },
        { status: 404 }
      );
    }

    if (!order) {
      
      return NextResponse.json(
        {

        },
        { status: 404 }
      );
    }

    // Log payment details

    // Items are already in the order object as JSONB
    // Ensure items array exists (fallback to empty array if null)
    const transformedOrder = {
      ...order,

    };

     ? transformedOrder.items.length : 0
    );

    return NextResponse.json({

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
