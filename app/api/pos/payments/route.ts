import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
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

    const body = await req.json();
    const {
      order_id,
      payment_method,
      payment_status,
      stripe_session_id,
      stripe_payment_intent_id,
    } = body;

    if (!order_id || !payment_method || !payment_status) {
      return NextResponse.json(
        { error: "order_id, payment_method, and payment_status are required" },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    // Get the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("venue_id, payment_mode, total_amount")
      .eq("id", order_id)
      .single();

    if (orderError) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Validate payment based on payment mode
    if (order.payment_mode === "online" && payment_status === "PAID" && !stripe_session_id) {
      return NextResponse.json(
        { error: "Online payments require stripe_session_id" },
        { status: 400 }
      );
    }

    // Update order payment status
    const updateData: Record<string, unknown> = {
      payment_status,
      payment_method,
    };

    if (stripe_session_id) {
      updateData.stripe_session_id = stripe_session_id;
    }

    if (stripe_payment_intent_id) {
      updateData.stripe_payment_intent_id = stripe_payment_intent_id;
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .select()
      .single();

    if (updateError) {
      logger.error("[POS PAYMENTS] Error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (_error) {
    logger.error("[POS PAYMENTS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id");
    const paymentStatus = searchParams.get("payment_status");
    const paymentMode = searchParams.get("payment_mode");

    if (!venueId) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    // Use admin client - no auth needed (venueId is sufficient)
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    let query = supabase
      .from("orders")
      .select(
        `
        id,
        table_number,
        table_id,
        source,
        customer_name,
        payment_status,
        payment_mode,
        total_amount,
        created_at,
        tables!left (
          label
        )
      `
      )
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (paymentStatus) {
      query = query.eq("payment_status", paymentStatus);
    }

    if (paymentMode) {
      query = query.eq("payment_mode", paymentMode);
    }

    const { data: orders, error } = await query;

    if (error) {
      logger.error("[POS PAYMENTS] Error:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders });
  } catch (_error) {
    logger.error("[POS PAYMENTS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
