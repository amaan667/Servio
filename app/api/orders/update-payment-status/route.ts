import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { apiErrors } from '@/lib/api/standard-response';

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentStatus, paymentMethod } = await req.json();

    if (!orderId || !paymentStatus) {
      return NextResponse.json(
        { error: "Order ID and payment status are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Convert to uppercase for database consistency
    const updateData: Record<string, unknown> = {
      payment_status: paymentStatus.toUpperCase(),
      updated_at: new Date().toISOString(),
    };

    if (paymentMethod) {
      updateData.payment_method = paymentMethod.toUpperCase();
    }

    const { data, error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (error) {
      logger.error("[UPDATE PAYMENT STATUS] Failed to update payment status:", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return apiErrors.internal(error.message || 'Internal server error');
    }

    return NextResponse.json({ success: true, data });
  } catch (_error) {
    logger.error("[UPDATE PAYMENT STATUS] Error:", {
      error: _error instanceof Error ? _error.message : "Unknown _error",
    });
    return NextResponse.json(
      { error: _error instanceof Error ? _error.message : "Internal server _error" },
      { status: 500 }
    );
  }
}
