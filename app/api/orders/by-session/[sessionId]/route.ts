import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionParams = { params?: { sessionId?: string } };

export async function GET(_req: Request, context: SessionParams = {}) {
  try {
    const supabaseAdmin = createAdminClient();
    const sessionId = context.params?.sessionId;

    if (!sessionId) {
      
      return apiErrors.badRequest("Session ID is required");
    }

    // Look up order by stripe_session_id with all fields including Stripe details
    // Items are stored as JSONB in orders table, not in separate order_items table
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .single();

    

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

     ? order.items.length : 0,

    // Items are already in the order object as JSONB
    // Ensure items array exists (fallback to empty array if null)
    const transformedOrder = {
      ...order,

    };

    
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
