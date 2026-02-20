import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Internal secret is not configured" }, { status: 503 });
    }

    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        venue_id,
        table_number,
        customer_name,
        items,
        total_amount,
        order_status,
        payment_status,
        payment_method,
        created_at,
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
          error: "Failed to fetch recent order",
          details: orderError.message,
        },
        { status: 500 }
      );
    }

    if (!recentOrder) {
      return NextResponse.json(
        {
          error: "No recent paid orders found",
        },
        { status: 404 }
      );
    }

    const { order_items: orderItems, ...orderWithoutItems } = recentOrder;
    const transformedOrder = {
      ...orderWithoutItems,
      items: orderItems || [],
    };

    return NextResponse.json({
      order: transformedOrder,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: _error instanceof Error ? _error.message : "Unknown _error",
      },
      { status: 500 }
    );
  }
}
