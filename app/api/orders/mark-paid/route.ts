import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { env, isDevelopment } from "@/lib/env";
import { apiErrors } from "@/lib/api/standard-response";
import {
  deriveQrTypeFromOrder,
  normalizePaymentMethod,
  validatePaymentMethodForQrType,
} from "@/lib/orders/qr-payment-validation";

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // CRITICAL: Rate limiting
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.PAYMENT);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      const { orderId } = await req.json();

      if (!orderId) {
        return apiErrors.badRequest("Order ID is required");
      }

      const supabase = createAdminClient();

      // Verify order belongs to authenticated venue (withUnifiedAuth already verified venue access)
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(
          "venue_id, payment_status, payment_method, payment_mode, qr_type, fulfillment_type, source, requires_collection"
        )
        .eq("id", orderId)
        .eq("venue_id", context.venueId) // Security: ensure order belongs to authenticated venue
        .single();

      if (orderError || !order) {

        return apiErrors.notFound("Order not found or access denied");
      }

      // Idempotent: if already paid, return success
      if (String(order.payment_status || "").toUpperCase() === "PAID") {
        return NextResponse.json({
          success: true,
          orderId,
          payment_status: "PAID",
          updated_at: new Date().toISOString(),
        });
      }

      const { data: venueSettings } = await supabase
        .from("venues")
        .select("allow_pay_at_till_for_table_collection")
        .eq("venue_id", context.venueId)
        .maybeSingle();

      const allowPayAtTillForTableCollection =
        venueSettings?.allow_pay_at_till_for_table_collection === true;

      const paymentMethod = normalizePaymentMethod(order.payment_method) || "PAY_AT_TILL";
      const qrType = deriveQrTypeFromOrder(order);

      const validation = validatePaymentMethodForQrType({
        qrType,
        paymentMethod,
        allowPayAtTillForTableCollection,
      });

      if (!validation.ok) {
        return NextResponse.json(
          {
            success: false,
            error: validation.error,
          },
          { status: 400 }
        );
      }

      if (!["PAY_AT_TILL", "PAY_LATER"].includes(paymentMethod)) {
        return NextResponse.json(
          {
            success: false,
            error: "Only Pay at Till or Pay Later orders can be confirmed here.",
          },
          { status: 400 }
        );
      }

      // Get the order details to find table_id (venue_id already fetched above)
      const { data: orderData, error: fetchError } = await supabase
        .from("orders")
        .select("table_id")
        .eq("id", orderId)
        .single();

      if (fetchError) {

        return apiErrors.notFound("Order not found");
      }

      // Update payment status
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "PAID",
          paid_at: new Date().toISOString(),
          paid_by_user_id: context.user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("venue_id", context.venueId); // Security: ensure venue matches

      if (error) {

        return NextResponse.json(
          {
            error: "Failed to mark order as paid",
            message: isDevelopment() ? error.message : "Database update failed",
          },
          { status: 500 }
        );
      }

      // If this is a table order, check if reservations should be auto-completed
      if (orderData?.table_id) {
        try {
          const baseUrl = env("NEXT_PUBLIC_SITE_URL") || "https://servio-production.up.railway.app";
          const completionResponse = await fetch(`${baseUrl}/api/reservations/check-completion`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              venueId: order.venue_id,
              tableId: orderData.table_id,
            }),
          });

          if (completionResponse.ok) {
            await completionResponse.json();
          }
        } catch (completionError) {

          // Don't fail the main request if completion check fails
        }
      }

      return NextResponse.json({
        success: true,
        orderId,
        payment_status: "PAID",
        updated_at: new Date().toISOString(),
      });
    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      // Check if it's an authentication/authorization error
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: isDevelopment() ? errorMessage : "Failed to mark order as paid",
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from order lookup
    extractVenueId: async (req) => {
      try {
        const body = await req.json();
        const orderId = body?.orderId;
        if (orderId) {
          const { createClient } = await import("@/lib/supabase");
          const supabase = await createClient();
          const { data: order } = await supabase
            .from("orders")
            .select("venue_id")
            .eq("id", orderId)
            .single();
          if (order?.venue_id) {
            return order.venue_id;
          }
        }
        return body?.venue_id || body?.venueId || null;
      } catch {
        return null;
      }
    },
    requireRole: ["owner", "manager", "staff", "server", "kitchen"],
  }
);
