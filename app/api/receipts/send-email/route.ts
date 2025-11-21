import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { getAuthenticatedUser } from "@/lib/middleware/authorization";

export async function POST(req: NextRequest) {
  try {
    const { orderId, email, venueId } = await req.json();

    if (!orderId || !email || !venueId) {
      return NextResponse.json(
        { error: "orderId, email, and venueId are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("venue_id", venueId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name, venue_email, venue_address")
      .eq("venue_id", venueId)
      .single();

    const venueName = venue?.venue_name || "Restaurant";
    const venueAddress = venue?.venue_address || "";

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
            <td style="text-align: right;">£${(((item.price || 0) * (item.quantity || 1)).toFixed(2))}</td>
          </tr>`
      )
      .join("");

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
              <p><strong>Order Number:</strong> #${orderId.slice(-6).toUpperCase()}</p>
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
              <p>You can always re-open this receipt from the link in your email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const emailSent = await sendEmail({
      to: email,
      subject: `Receipt for Order #${orderId.slice(-6).toUpperCase()} - ${venueName}`,
      html: receiptHtml,
      text: `Receipt for Order #${orderId.slice(-6).toUpperCase()}\n\n${venueName}\n\nOrder Number: #${orderId.slice(-6).toUpperCase()}\nTotal: £${subtotal.toFixed(2)}\n\nThank you for your order!`,
    });

    if (!emailSent) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    // Update order with receipt sent info
    await supabase
      .from("orders")
      .update({
        receipt_sent_at: new Date().toISOString(),
        receipt_channel: "email",
        receipt_email: email,
      })
      .eq("id", orderId);

    return NextResponse.json({ success: true, message: "Receipt sent successfully" });
  } catch (error) {
    logger.error("[RECEIPTS EMAIL] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


