import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { logger } from "@/lib/logger";

interface ReceiptData {
  venueName: string;
  venueAddress?: string;
  venueEmail?: string;
  orderId: string;
  orderNumber: string;
  tableNumber?: number | string;
  customerName?: string;
  items: Array<{
    item_name: string;
    quantity: number;
    price: number;
    special_instructions?: string;
  }>;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  createdAt: string;
}

/**
 * Generate receipt HTML template
 */
function generateReceiptHTML(data: ReceiptData): string {
  const itemsHtml = data.items
    .map((item) => {
      const itemTotal = item.price * item.quantity;
      return `
        <tr>
          <td style="padding: 8px 0;">
            <div style="font-weight: 500;">${item.item_name || "Item"}</div>
            <div style="color: #666; font-size: 0.9em;">Quantity: ${item.quantity}</div>
            ${item.special_instructions ? `<div style="color: #666; font-size: 0.85em; font-style: italic; margin-top: 4px;">Note: ${item.special_instructions}</div>` : ""}
          </td>
          <td style="text-align: right; padding: 8px 0; font-weight: 500;">£${itemTotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  const date = new Date(data.createdAt);
  const formattedDate = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt #${data.orderNumber}</title>
        <style>
          @page {
            margin: 15mm;
            size: A4;
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: white;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          
          .header {
            text-align: center;
            border-bottom: 3px solid #7c3aed;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .header h1 {
            color: #7c3aed;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          
          .header p {
            color: #6b7280;
            margin-top: 8px;
            font-size: 14px;
          }
          
          .order-info {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
            border: 1px solid #e5e7eb;
          }
          
          .order-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .order-info-row:last-child {
            margin-bottom: 0;
          }
          
          .order-info-label {
            color: #6b7280;
            font-weight: 500;
          }
          
          .order-info-value {
            color: #1f2937;
            font-weight: 600;
          }
          
          .order-number {
            font-size: 18px;
            font-weight: 700;
            color: #7c3aed;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
          }
          
          table thead {
            background: #f9fafb;
            border-bottom: 2px solid #e5e7eb;
          }
          
          table th {
            padding: 12px 0;
            text-align: left;
            font-weight: 600;
            color: #374151;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          table th:last-child {
            text-align: right;
          }
          
          table td {
            padding: 12px 0;
            border-bottom: 1px solid #f3f4f6;
          }
          
          table tr:last-child td {
            border-bottom: none;
          }
          
          .totals {
            margin-top: 25px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
          }
          
          .total-row.total-final {
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 2px solid #e5e7eb;
          }
          
          .total-label {
            color: #6b7280;
          }
          
          .total-value {
            color: #1f2937;
            font-weight: 600;
          }
          
          .payment-info {
            text-align: center;
            margin-top: 25px;
            padding: 15px;
            background: #f0fdf4;
            border-radius: 8px;
            border: 1px solid #bbf7d0;
          }
          
          .payment-info p {
            margin: 4px 0;
            font-size: 14px;
            color: #166534;
          }
          
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${data.venueName}</h1>
          ${data.venueAddress ? `<p>${data.venueAddress}</p>` : ""}
          ${data.venueEmail ? `<p>${data.venueEmail}</p>` : ""}
        </div>
        
        <div class="order-info">
          <div class="order-number">Order #${data.orderNumber}</div>
          ${data.tableNumber ? `<div class="order-info-row"><span class="order-info-label">Table:</span><span class="order-info-value">${data.tableNumber}</span></div>` : ""}
          ${data.customerName ? `<div class="order-info-row"><span class="order-info-label">Customer:</span><span class="order-info-value">${data.customerName}</span></div>` : ""}
          <div class="order-info-row"><span class="order-info-label">Date:</span><span class="order-info-value">${formattedDate}</span></div>
          <div class="order-info-row"><span class="order-info-label">Time:</span><span class="order-info-value">${formattedTime}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span class="total-label">Subtotal:</span>
            <span class="total-value">£${data.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">VAT (20%):</span>
            <span class="total-value">£${data.vatAmount.toFixed(2)}</span>
          </div>
          <div class="total-row total-final">
            <span>Total:</span>
            <span>£${data.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        ${
          data.paymentMethod
            ? `
          <div class="payment-info">
            <p><strong>Payment Method:</strong> ${data.paymentMethod.replace(/_/g, " ").toUpperCase()}</p>
            <p>Payment Status: PAID</p>
          </div>
        `
            : ""
        }

        <div class="footer">
          <p>Thank you for your order!</p>
          <p style="margin-top: 8px;">Receipt #${data.orderNumber}</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate PDF from receipt data using Puppeteer
 */
export async function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  let browser;

  try {
    // Configure Chromium for serverless/server environments
    const isProduction = process.env.NODE_ENV === "production";

    const browserOptions = isProduction
      ? {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport || { width: 1920, height: 1080 },
          executablePath: await chromium.executablePath(),
          headless: chromium.headless ?? true,
        }
      : {
          headless: true,
        };

    browser = await puppeteerCore.launch(browserOptions);
    const page = await browser.newPage();

    // Generate HTML
    const html = generateReceiptHTML(data);

    // Set content and wait for fonts/styles to load
    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "15mm",
        right: "15mm",
        bottom: "15mm",
        left: "15mm",
      },
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    logger.error("[PDF GENERATION] Error generating PDF:", error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate receipt HTML (for fallback/print)
 */
export function generateReceiptHTMLForPrint(data: ReceiptData): string {
  return generateReceiptHTML(data);
}
