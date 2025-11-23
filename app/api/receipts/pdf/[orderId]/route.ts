import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name, venue_email, venue_address")
      .eq("venue_id", order.venue_id)
      .single();

    const venueName = venue?.venue_name || "Restaurant";
    const venueAddress = venue?.venue_address || "";

    // Calculate VAT (20% UK standard rate)
    const subtotal = order.total_amount || 0;
    const vatRate = 0.2;
    const vatAmount = subtotal * (vatRate / (1 + vatRate));
    const netAmount = subtotal - vatAmount;

    // Generate PDF HTML
    const itemsHtml = (order.items || [])
      .map(
        (item: { item_name?: string; quantity?: number; price?: number; special_instructions?: string }) => {
          const itemTotal = (item.price || 0) * (item.quantity || 1);
          return `
            <tr>
              <td>${item.item_name || "Item"} × ${item.quantity || 1}${item.special_instructions ? `<br><small style="color: #666;">Note: ${item.special_instructions}</small>` : ""}</td>
              <td style="text-align: right;">£${itemTotal.toFixed(2)}</td>
            </tr>
          `;
        }
      )
      .join("");

    const pdfHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 20mm; }
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { color: #7c3aed; margin: 0; font-size: 24px; }
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
          </div>
        </body>
      </html>
    `;

    // Generate actual PDF using puppeteer/chromium
    try {
      const chromium = require("@sparticuz/chromium");
      const puppeteer = require("puppeteer-core");

      // Configure chromium for serverless environments
      chromium.setGraphicsMode(false);

      const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });

      const page = await browser.newPage();
      await page.setContent(pdfHtml, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: "A4",
        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "20mm",
          left: "20mm",
        },
        printBackground: true,
      });

      await browser.close();

      return new NextResponse(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="receipt-${orderId.slice(-6).toUpperCase()}.pdf"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (pdfError) {
      logger.warn("[RECEIPTS PDF] PDF generation failed, falling back to HTML:", pdfError);
      // Fallback to HTML if PDF generation fails
      return new NextResponse(pdfHtml, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="receipt-${orderId.slice(-6).toUpperCase()}.html"`,
        },
      });
    }
  } catch (error) {
    logger.error("[RECEIPTS PDF] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}


