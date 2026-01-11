import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { env, isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

export const runtime = "nodejs";

const sendEmailSchema = z.object({

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(sendEmailSchema, await req.json());
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
        .select("venue_name, email, address")
        .eq("venue_id", finalVenueId)
        .single();

      const venueName = venue?.venue_name || "Restaurant";
      const venueAddress = venue?.address || "";

      // Calculate VAT (20% UK standard rate)
      const subtotal = order.total_amount || 0;
      const vatRate = 0.2;
      const vatAmount = subtotal * (vatRate / (1 + vatRate));
      const netAmount = subtotal - vatAmount;

      // Generate receipt HTML
      const itemsHtml = (order.items || [])
        .map(
          (item: { item_name?: string; quantity?: number; price?: number }) =>
            `<tr>
              <td>${item.item_name || "Item"} × ${item.quantity || 1}</td>
              <td style="text-align: right;">£${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td>
            </tr>`
        )
        .join("");

      const baseUrl = env("NEXT_PUBLIC_BASE_URL") || "https://servio.app";
      const receiptHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 20px; }
              .header h1 { color: #7c3aed; margin: 0; }
              .order-info { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
              .order-info p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              table td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
              table tr:last-child td { border-bottom: none; }
              .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 10px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${venueName}</h1>
                ${venueAddress ? `<p>${venueAddress}</p>` : ""}
              </div>
              
              <div class="order-info">
                <p><strong>Order Number:</strong> #${body.orderId.slice(-6).toUpperCase()}</p>
                ${order.table_number ? `<p><strong>Table:</strong> ${order.table_number}</p>` : ""}
                ${order.customer_name ? `<p><strong>Customer:</strong> ${order.customer_name}</p>` : ""}
                <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
                <p><strong>Time:</strong> ${new Date(order.created_at).toLocaleTimeString()}</p>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="text-align: left;">Item</th>
                    <th style="text-align: right;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div style="text-align: right;">
                <p>Subtotal: £${netAmount.toFixed(2)}</p>
                <p>VAT (20%): £${vatAmount.toFixed(2)}</p>
                <p class="total">Total: £${subtotal.toFixed(2)}</p>
              </div>

              ${order.payment_method ? `<p style="text-align: center; margin-top: 20px;"><strong>Payment Method:</strong> ${order.payment_method.replace("_", " ")}</p>` : ""}

              <div class="footer">
                <p>Thank you for your order!</p>
                <p style="margin-top: 15px;">
                  <a href="${baseUrl}/receipts/${body.orderId}" 
                     style="display: inline-block; background-color: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    View Receipt Online
                  </a>
                </p>
                <p style="margin-top: 10px; font-size: 11px; color: #6b7280;">
                  You can always access this receipt at: ${baseUrl}/receipts/${body.orderId}
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      // Send email
      const emailSent = await sendEmail({

        subject: `Receipt for Order #${body.orderId.slice(-6).toUpperCase()} - ${venueName}`,

        text: `Receipt for Order #${body.orderId.slice(-6).toUpperCase()}\n\n${venueName}\n\nOrder Number: #${body.orderId.slice(-6).toUpperCase()}\nTotal: £${subtotal.toFixed(2)}\n\nThank you for your order!`,

      if (!emailSent) {
        return apiErrors.internal("Failed to send email");
      }

      // Update order with receipt sent info
      await supabase
        .from("orders")
        .update({

        .eq("id", body.orderId);

      

      // STEP 4: Return success response
      return success({ message: "Receipt sent successfully" });
    } catch (error) {

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Failed to send email receipt",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // Extract venueId from body

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
