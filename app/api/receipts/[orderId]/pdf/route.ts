import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
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

    // Verify venue access if venueId provided
    if (venueId && order.venue_id !== venueId) {
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

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    const { width, height } = page.getSize();

    // Load fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let yPosition = height - 50;

    // Header - Venue Name
    page.drawText(venueName, {
      x: 50,
      y: yPosition,
      size: 24,
      font: helveticaBoldFont,
      color: rgb(0.49, 0.23, 0.93), // Purple color
    });

    yPosition -= 30;

    // Venue Address
    if (venueAddress) {
      page.drawText(venueAddress, {
        x: 50,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
      });
      yPosition -= 20;
    }

    // Divider line
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: width - 50, y: yPosition },
      thickness: 2,
      color: rgb(0.49, 0.23, 0.93),
    });

    yPosition -= 30;

    // Order Information Section
    page.drawText("Order Information", {
      x: 50,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 25;

    const orderDate = new Date(order.created_at);
    const orderInfo = [
      [`Order Number:`, `#${orderId.slice(-6).toUpperCase()}`],
      [`Date:`, orderDate.toLocaleDateString("en-GB")],
      [`Time:`, orderDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })],
    ];

    if (order.table_number) {
      orderInfo.push([`Table:`, order.table_number.toString()]);
    }

    if (order.customer_name) {
      orderInfo.push([`Customer:`, order.customer_name]);
    }

    for (const [label, value] of orderInfo) {
      page.drawText(label, {
        x: 50,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText(value, {
        x: 200,
        y: yPosition,
        size: 10,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 18;
    }

    yPosition -= 20;

    // Items Section
    page.drawText("Items", {
      x: 50,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 25;

    // Table header
    page.drawText("Item", {
      x: 50,
      y: yPosition,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Quantity", {
      x: 350,
      y: yPosition,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Price", {
      x: 450,
      y: yPosition,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText("Total", {
      x: 520,
      y: yPosition,
      size: 10,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 20;

    // Draw line under header
    page.drawLine({
      start: { x: 50, y: yPosition },
      end: { x: width - 50, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    yPosition -= 15;

    // Items
    const items = order.items || [];
    for (const item of items) {
      const itemName = item.item_name || "Item";
      const quantity = item.quantity || 1;
      const price = item.price || 0;
      const itemTotal = price * quantity;

      // Wrap long item names
      const maxWidth = 280;
      const itemNameLines = wrapText(itemName, maxWidth, helveticaFont, 10);
      
      for (let i = 0; i < itemNameLines.length; i++) {
        page.drawText(itemNameLines[i], {
          x: 50,
          y: yPosition,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 15;
      }

      // If item name wrapped, adjust other columns
      const itemNameHeight = itemNameLines.length * 15;
      const baseY = yPosition + itemNameHeight - 15;

      page.drawText(quantity.toString(), {
        x: 350,
        y: baseY,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });

      page.drawText(`£${price.toFixed(2)}`, {
        x: 450,
        y: baseY,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });

      page.drawText(`£${itemTotal.toFixed(2)}`, {
        x: 520,
        y: baseY,
        size: 10,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });

      yPosition -= 10;

      // Special instructions
      if (item.special_instructions || item.specialInstructions) {
        const instructions = item.special_instructions || item.specialInstructions;
        page.drawText(`  Note: ${instructions}`, {
          x: 50,
          y: yPosition,
          size: 8,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5),
        });
        yPosition -= 15;
      }

      yPosition -= 5;
    }

    yPosition -= 20;

    // Totals Section
    page.drawLine({
      start: { x: 450, y: yPosition },
      end: { x: width - 50, y: yPosition },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    yPosition -= 20;

    page.drawText("Subtotal:", {
      x: 450,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(`£${netAmount.toFixed(2)}`, {
      x: 520,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 18;

    page.drawText("VAT (20%):", {
      x: 450,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(`£${vatAmount.toFixed(2)}`, {
      x: 520,
      y: yPosition,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 25;

    page.drawText("Total:", {
      x: 450,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    page.drawText(`£${subtotal.toFixed(2)}`, {
      x: 520,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });

    yPosition -= 30;

    // Payment Method
    if (order.payment_method) {
      const paymentMethod = order.payment_method.replace("_", " ").toUpperCase();
      page.drawText(`Payment Method: ${paymentMethod}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 20;
    }

    // Footer
    yPosition = 50;
    page.drawText("Thank you for your order!", {
      x: 50,
      y: yPosition,
      size: 12,
      font: helveticaBoldFont,
      color: rgb(0.49, 0.23, 0.93),
    });

    yPosition -= 20;
    const receiptUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://servio.app"}/receipts/${orderId}`;
    page.drawText(`View online: ${receiptUrl}`, {
      x: 50,
      y: yPosition,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF as response
    return new NextResponse(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt-${orderId.slice(-6)}.pdf"`,
      },
    });
  } catch (error) {
    logger.error("[RECEIPTS PDF] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to wrap text
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

