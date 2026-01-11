import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  try {
    const supabaseAdmin = createAdminClient();

    // Get the most recent paid order from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        *,
        order_items (
          id,
          menu_item_id,
          item_name,
          quantity,
          price,
          special_instructions
        )
      `
      )
      .eq("payment_status", "PAID")
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      
      return NextResponse.json(
        {

        },
        { status: 500 }
      );
    }

    if (!recentOrder) {
      return NextResponse.json(
        {

        },
        { status: 404 }
      );
    }

    

    // Transform the order to include items array
    const transformedOrder = {
      ...recentOrder,

    };

    // Remove the order_items property since we have items now
    delete transformedOrder.order_items;

    return NextResponse.json({

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
