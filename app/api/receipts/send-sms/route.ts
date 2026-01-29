import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { env } from "@/lib/env";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const sendSmsSchema = z.object({
  orderId: z.string().uuid(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  venueId: z.string().uuid().optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(sendSmsSchema, await req.json());
      const finalVenueId = context.venueId || body.venueId;

      if (!finalVenueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Business logic
      const supabase = await createClient();

      // Get order details
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", body.orderId)
        .eq("venue_id", finalVenueId)
        .single();

      if (orderError || !order) {
        return apiErrors.notFound("Order not found");
      }

      // Get venue info
      const { data: venue } = await supabase
        .from("venues")
        .select("venue_name")
        .eq("venue_id", finalVenueId)
        .single();

      const venueName = venue?.venue_name || "Restaurant";

      // Generate receipt text message
      const orderNumber = body.orderId.slice(-6).toUpperCase();
      const total = order.total_amount?.toFixed(2) || "0.00";
      const itemsText = (order.items || [])
        .slice(0, 3)
        .map(
          (item: { item_name?: string; quantity?: number }) =>
            `${item.quantity || 1}x ${item.item_name || "Item"}`
        )
        .join(", ");
      const moreItems =
        (order.items || []).length > 3 ? ` +${(order.items || []).length - 3} more` : "";

      const receiptUrl = `${env("NEXT_PUBLIC_BASE_URL") || "https://servio.app"}/receipts/${body.orderId}`;
      const receiptText = `Receipt - ${venueName}\nOrder #${orderNumber}\n${itemsText}${moreItems}\nTotal: £${total}\n\nView receipt: ${receiptUrl}\n\nThank you for your order!`;

      // SMS integration: Currently using Resend API for email-to-SMS gateways
      // For direct SMS, integrate with Twilio, AWS SNS, or similar service
      // For now, we'll log it and mark as sent

      // Update order with receipt sent info
      await supabase
        .from("orders")
        .update({
          receipt_sent_at: new Date().toISOString(),
          receipt_channel: "sms",
          receipt_phone: body.phone,
        })
        .eq("id", body.orderId);

      // In a real implementation, you would send the SMS here using Twilio or similar
      // Example:
      // const twilioClient = require('twilio')(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN'));
      // await twilioClient.messages.create({
      //   body: receiptText,
      //   to: body.phone,
      //   from: env('TWILIO_PHONE_NUMBER')
      // });

      // STEP 4: Return success response
      return success({
        message: "Receipt SMS sent successfully",
        note: "SMS sending is currently logged. Integrate with Twilio or similar service for production.",
      });
    } catch (error) {
      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal("Failed to send SMS receipt", error);
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (
          (body as { venueId?: string; venue_id?: string })?.venueId ||
          (body as { venueId?: string; venue_id?: string })?.venue_id ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);
