import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";

interface ReceiptData {

  }>;

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

    .join("");

  const date = new Date(data.createdAt);
  const formattedDate = date.toLocaleDateString("en-GB", {

  const formattedTime = date.toLocaleTimeString("en-GB", {

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt #${data.orderNumber}</title>
        <style>
          @page {

          }
          
          * {

          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;

          }
          
          .header {
            text-align: center;
            border-bottom: 3px solid ${data.primaryColor || "#7c3aed"};
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .header img {
            max-height: 160px;
            max-width: 100%;
            margin-bottom: 20px;
            object-fit: contain;
          }
          
          .header h1 {
            color: ${data.primaryColor || "#7c3aed"};

          }
          
          .header p {

          }
          
          .order-info {

          }
          
          .order-info-row {

          }
          
          .order-info-row:last-child {
            margin-bottom: 0;
          }
          
          .order-info-label {

          }
          
          .order-info-value {

          }
          
          .order-number {
            font-size: 18px;
            font-weight: 700;
            color: ${data.primaryColor || "#7c3aed"};
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          table {

          }
          
          table thead {

          }
          
          table th {

          }
          
          table th:last-child {
            text-align: right;
          }
          
          table td {

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

          }
          
          .total-row.total-final {
            font-size: 20px;
            font-weight: 700;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 2px solid #e5e7eb;
          }
          
          .total-row.total-final .total-value {
            color: ${data.primaryColor || "#7c3aed"};
          }
          
          .total-label {

          }
          
          .total-value {

          }
          
          .payment-info {
            text-align: center;
            margin-top: 25px;

          }
          
          .payment-info p {

          }
          
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;

          }
          
          @media print {
            body {

            }
            
            .no-print {

            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${data.logoUrl ? `<img src="${data.logoUrl}" alt="" />` : ""}
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

          defaultViewport: { width: 1920, height: 1080 },

        }

        };

    browser = await puppeteerCore.launch(browserOptions);
    const page = await browser.newPage();

    // Generate HTML
    const html = generateReceiptHTML(data);

    // Set content and wait for fonts/styles to load
    await page.setContent(html, {

    // Generate PDF
    const pdfBuffer = await page.pdf({

      },

    return Buffer.from(pdfBuffer);
  } catch (error) {
    
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
