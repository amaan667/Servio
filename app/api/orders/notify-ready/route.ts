import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { env } from "@/lib/env";
import { z } from "zod";

export const runtime = "nodejs";

const notifyReadySchema = z.object({
  orderId: z.string().uuid(),
  venueId: z.string().uuid(),
  notificationChannels: z
    .array(z.enum(["sms", "email"]))
    .optional()
    .default([]),
});

/**
 * API endpoint to send "Order Ready" notifications to customers
 * Supports SMS, email, and in-app notifications
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    // Validate input (already done by unified handler)
    const { body } = context;
    const { orderId, venueId, notificationChannels = [] } = body;

    // STEP 3: Get order and venue details
    const supabase = await createServerSupabase();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .single();

    if (orderError || !order) {
      return apiErrors.notFound("Order not found");
    }

    // Only send notifications for orders that are actually READY
    if (order.order_status !== "READY") {
      return apiErrors.badRequest("Order is not in READY status");
    }

    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name, phone, email, service_type")
      .eq("venue_id", venueId)
      .single();

    const venueName = venue?.venue_name || "Restaurant";
    const orderNumber = orderId.slice(-6).toUpperCase();
    const customerName = order.customer_name || "Customer";

    const notificationResults: {
      sms?: { sent: boolean; error?: string };
      email?: { sent: boolean; error?: string };
    } = {};

    // STEP 4: Send SMS notification if requested and phone number available
    if (notificationChannels.includes("sms") && order.customer_phone) {
      try {
        const smsMessage = `🎉 ${customerName}, your order #${orderNumber} at ${venueName} is ready! Please collect at the counter. Thank you!`;

        // Check if Twilio is configured (using process.env for optional vars)
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

        if (twilioSid && twilioToken && twilioPhone) {
          // Dynamic import to avoid errors if twilio package isn't installed
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const twilio = require("twilio") as (
              sid: string,
              token: string
            ) => {
              messages: {
                create: (opts: { body: string; to: string; from: string }) => Promise<unknown>;
              };
            };
            const twilioClient = twilio(twilioSid, twilioToken);

            await twilioClient.messages.create({
              body: smsMessage,
              to: order.customer_phone,
              from: twilioPhone,
            });

            notificationResults.sms = { sent: true };
          } catch {
            // Twilio package not installed or error - skip SMS silently
            notificationResults.sms = {
              sent: false,
              error: "SMS service (Twilio) not available.",
            };
          }
        } else {
          // SMS not configured - skip silently
          notificationResults.sms = {
            sent: false,
            error: "SMS service not configured.",
          };
        }

        // Update order with notification sent info
        await supabase
          .from("orders")
          .update({
            ready_notification_sent_at: new Date().toISOString(),
            ready_notification_channel: "sms",
          })
          .eq("id", orderId);
      } catch {
        // SMS error - continue without failing
        notificationResults.sms = {
          sent: false,
          error: "Failed to send SMS",
        };
      }
    }

    // STEP 5: Send email notification if requested and email available
    if (notificationChannels.includes("email") && order.customer_email) {
      try {
        const baseUrl = env("NEXT_PUBLIC_SITE_URL") || "https://servio.app";
        const orderTrackingUrl = `${baseUrl}/order-summary/${orderId}`;

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Your Order is Ready!</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="margin: 0; font-size: 28px;">🎉 Your Order is Ready!</h1>
                </div>
                
                <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                  <p style="font-size: 18px;">Hi ${customerName},</p>
                  
                  <p style="font-size: 16px;">Great news! Your order at <strong>${venueName}</strong> is ready for collection.</p>
                  
                  <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0; color: #065f46; font-size: 14px;">ORDER NUMBER</p>
                    <p style="margin: 0; font-size: 36px; font-weight: bold; color: #059669; letter-spacing: 2px;">#${orderNumber}</p>
                  </div>
                  
                  <p style="font-size: 16px; text-align: center;">Please proceed to the counter to collect your order.</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${orderTrackingUrl}" style="display: inline-block; background: #10B981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Order Details</a>
                  </div>
                  
                  <p style="font-size: 14px; color: #6b7280; text-align: center;">
                    Thank you for choosing ${venueName}!
                  </p>
                </div>
                
                <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
                  <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                    This notification was sent by ${venueName} via Servio
                  </p>
                </div>
              </div>
            </body>
            </html>
          `;

        // Try to send email using Resend
        if (env("RESEND_API_KEY")) {
          const { Resend } = await import("resend");
          const resend = new Resend(env("RESEND_API_KEY"));

          const result = await resend.emails.send({
            from: `${venueName} <orders@servio.uk>`,
            to: order.customer_email,
            subject: `🎉 Your Order #${orderNumber} is Ready for Collection!`,
            html: emailHtml,
          });

          if (result.data) {
            notificationResults.email = { sent: true };
          } else {
            throw new Error(result.error?.message || "Failed to send email");
          }
        } else {
          // Email service not configured - skip silently
          notificationResults.email = {
            sent: false,
            error: "Email service not configured.",
          };
        }

        // Update order with notification sent info
        await supabase
          .from("orders")
          .update({
            ready_notification_sent_at: new Date().toISOString(),
            ready_notification_channel: notificationResults.sms?.sent ? "both" : "email",
          })
          .eq("id", orderId);
      } catch (emailError) {
        // Email error - continue without failing
        notificationResults.email = {
          sent: false,
          error: emailError instanceof Error ? emailError.message : "Failed to send email",
        };
      }
    }

    return success({
      message: "Order ready notification processed",
      orderId,
      orderNumber,
      notifications: notificationResults,
      customerPhone: order.customer_phone ? `***${order.customer_phone.slice(-4)}` : null,
      customerEmail: order.customer_email
        ? `${order.customer_email.slice(0, 3)}***@${order.customer_email.split("@")[1]}`
        : null,
    });
  },
  {
    schema: notifyReadySchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const body = await req
          .clone()
          .json()
          .catch(() => ({}));
        return (body as { venueId?: string })?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);
