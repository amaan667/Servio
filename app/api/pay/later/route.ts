import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';
import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
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

    const { order_id, venue_id, sessionId } = body;

    logger.info("⏰ [PAY LATER] Pay later requested", {
      orderId: order_id,
      sessionId,
      fullBody: body,
      timestamp: new Date().toISOString(),
    });

    if (!order_id) {
      logger.error("[PAY LATER] ❌ Missing order ID in request body");
      logger.error("❌ [PAY LATER] Missing order ID");
      return NextResponse.json(
        {
          success: false,
          error: "Order ID is required",
        },
        { status: 400 }
      );
    }

    if (!venue_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Venue ID is required",
        },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = await createServerSupabase();

    // Verify order belongs to venue (security check)
    const { data: orderCheck, error: checkError } = await supabase
      .from("orders")
      .select("venue_id")
      .eq("id", order_id)
      .eq("venue_id", venue_id) // Security: ensure order belongs to venue
      .single();

    if (checkError || !orderCheck) {
      logger.error("[PAY LATER] Order not found or venue mismatch:", {
        order_id,
        venueId: venue_id,
        error: checkError,
      });
      return NextResponse.json(
        { success: false, error: "Order not found or access denied" },
        { status: 404 }
      );
    }

    // Step 3: Attempt to update order
    // IMPORTANT: payment_status should remain "UNPAID", only payment_mode changes to "pay_later"
    const updateData = {
      payment_mode: "pay_later", // Set payment mode to pay_later
      payment_status: "UNPAID", // Keep as UNPAID (not PAY_LATER)
      payment_method: null, // No payment method yet
      updated_at: new Date().toISOString(),
    };

    const { data: order, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order_id)
      .eq("venue_id", venue_id) // Security: ensure venue matches
      .select()
      .single();

    if (updateError || !order) {
      logger.error("[PAY LATER] ❌ Update failed:", {
        orderId: order_id,
        error: updateError,
        fullError: JSON.stringify(updateError, null, 2),
      });
      logger.error("❌ [PAY LATER] Failed to update order", {
        orderId: order_id,
        error: updateError?.message,
        fullError: updateError,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to process order",
          details: updateError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    logger.info("✅ [PAY LATER] Order marked as pay later successfully", {
      orderId: order.id,
      tableNumber: order.table_number,
      total: order.total_amount,
      orderNumber: order.order_number,
      note: "Customer can re-scan QR to pay online",
    });

    const response = {
      success: true,
      order_number: order.order_number,
      data: {
        order_id: order.id,
        payment_status: "UNPAID",
        payment_mode: "pay_later",
        total_amount: order.total_amount,
      },
    };

      return NextResponse.json(response);
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[PAY LATER] 💥 EXCEPTION CAUGHT:", {
        error: errorMessage,
        stack: errorStack,
      });

      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            success: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          success: false,
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Payment processing failed",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
}
