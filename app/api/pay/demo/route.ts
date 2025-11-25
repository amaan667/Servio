import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
    const rateLimitResult = await rateLimit(req as unknown as NextRequest, RATE_LIMITS.GENERAL);
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
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(_name: string, _value: string, _options: unknown) {
            /* Empty */
          },
          remove(_name: string, _options: unknown) {
            /* Empty */
          },
        },
      }
    );

    // Update order payment status to paid with demo method
    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_method: "demo",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id)
      .select()
      .single();

    if (updateError || !order) {
      logger.error("[PAY DEMO] Failed to update order:", { value: updateError });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to process payment",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        payment_status: "PAID",
        payment_method: "demo",
        total_amount: order.total_amount,
      },
    });
  } catch (_error) {
    logger.error("[PAY DEMO] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
