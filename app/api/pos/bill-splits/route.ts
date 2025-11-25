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
      const venueAccessResult = await requireVenueAccessForAPI(venueId);
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
    const { venue_id, table_session_id, counter_session_id, splits, action } = body;

    if (!venue_id || !splits || !Array.isArray(splits)) {
      return NextResponse.json(
        { error: "venue_id and splits array are required" },
        { status: 400 }
      );
    }

    // Use admin client - no auth needed
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    let result;

    switch (action) {
      case "create_splits":
        // Create bill splits
        const billSplits = [];

        for (let i = 0; i < splits.length; i++) {
          const split = splits[i];

          // Create bill split record
          const { data: billSplit, error: splitError } = await supabase
            .from("bill_splits")
            .insert({
              venue_id,
              table_session_id,
              counter_session_id,
              split_number: i + 1,
              total_amount: split.total_amount,
              payment_status: "UNPAID",
            })
            .select()
            .single();

          if (splitError) {
            logger.error("[POS BILL SPLITS] Error creating split:", splitError);
            return NextResponse.json({ error: "Failed to create bill split" }, { status: 500 });
          }

          // Link orders to this split
          if (split.order_ids && split.order_ids.length > 0) {
            const orderSplitLinks = split.order_ids.map((orderId: string) => ({
              order_id: orderId,
              bill_split_id: billSplit.id,
              amount: split.total_amount / split.order_ids.length,
            }));

            const { error: linksError } = await supabase
              .from("order_bill_splits")
              .insert(orderSplitLinks);

            if (linksError) {
              logger.error("[POS BILL SPLITS] Error linking orders:", linksError);
              return NextResponse.json(
                { error: "Failed to link orders to split" },
                { status: 500 }
              );
            }
          }

          billSplits.push(billSplit);
        }

        result = { splits: billSplits, action: "created" };
        break;

      case "pay_split": {
        const { split_id, payment_method } = body;

        if (!split_id || !payment_method) {
          return NextResponse.json(
            { error: "split_id and payment_method are required" },
            { status: 400 }
          );
        }

        // Mark split as paid
        const { data: paidSplit, error: payError } = await supabase
          .from("bill_splits")
          .update({
            payment_status: "PAID",
            payment_method,
          })
          .eq("id", split_id)
          .eq("venue_id", venue_id)
          .select()
          .single();

        if (payError) {
          logger.error("[POS BILL SPLITS] Error paying split:", payError);
          return NextResponse.json({ error: "Failed to mark split as paid" }, { status: 500 });
        }

        result = { split: paidSplit, action: "paid" };
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (_error) {
    logger.error("[POS BILL SPLITS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venue_id");
    const tableSessionId = searchParams.get("table_session_id");
    const counterSessionId = searchParams.get("counter_session_id");

    if (!venueId) {
      return NextResponse.json({ error: "venue_id is required" }, { status: 400 });
    }

    // Use admin client - no auth needed (venueId is sufficient)
    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    let query = supabase
      .from("bill_splits")
      .select(
        `
        *,
        order_bill_splits (
          order_id,
          amount,
          orders (
            id,
            customer_name,
            total_amount,
            order_status
          )
        )
      `
      )
      .eq("venue_id", venueId);

    if (tableSessionId) {
      query = query.eq("table_session_id", tableSessionId);
    }

    if (counterSessionId) {
      query = query.eq("counter_session_id", counterSessionId);
    }

    const { data: splits, error } = await query.order("split_number");

    if (error) {
      logger.error("[POS BILL SPLITS] Error fetching splits:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ splits });
  } catch (_error) {
    logger.error("[POS BILL SPLITS] Unexpected error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
