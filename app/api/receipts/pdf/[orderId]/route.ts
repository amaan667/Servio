import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { generateReceiptPDF, generateReceiptHTMLForPrint } from "@/lib/pdf/generateReceiptPDF";

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Check if HTML format is requested (for fallback/print)
    const format = req.nextUrl.searchParams.get("format");
    const preferHTML = format === "html";

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

    // Get logo and detected colors from menu design settings
    const { data: designSettings } = await supabase
      .from("menu_design_settings")
      .select("logo_url, detected_primary_color, primary_color")
      .eq("venue_id", order.venue_id)
      .single();

    // Get venue contact info
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name, venue_email, venue_address")
      .eq("venue_id", order.venue_id)
      .single();

    const venueName = venue?.venue_name || "Restaurant";
    const venueAddress = venue?.venue_address || "";
    const venueEmail = venue?.venue_email || "";
    const logoUrl = designSettings?.logo_url || undefined;
    
    // Use detected primary color from logo (stored when logo was uploaded), fallback to default
    const primaryColor = designSettings?.detected_primary_color || designSettings?.primary_color || "#8b5cf6";

    // Calculate VAT (20% UK standard rate)
    const totalAmount = order.total_amount || 0;
    const vatRate = 0.2;
    const vatAmount = totalAmount * (vatRate / (1 + vatRate));
    const subtotal = totalAmount - vatAmount;

    // Prepare receipt data
    const receiptData = {
      venueName,
      venueAddress,
      venueEmail,
      logoUrl,
      primaryColor,
      orderId: order.id,
      orderNumber: orderId.slice(-6).toUpperCase(),
      tableNumber: order.table_number,
      customerName: order.customer_name || undefined,
      items: (order.items || []).map(
        (item: {
          item_name?: string;
          quantity?: number;
          price?: number;
          special_instructions?: string;
        }) => ({
          item_name: item.item_name || "Item",
          quantity: item.quantity || 1,
          price: item.price || 0,
          special_instructions: item.special_instructions,
        })
      ),
      subtotal,
      vatAmount,
      totalAmount,
      paymentMethod: order.payment_method || undefined,
      createdAt: order.created_at,
    };

    // Generate PDF or HTML based on request
    if (preferHTML) {
      // Return HTML for browser printing
      const html = generateReceiptHTMLForPrint(receiptData);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `inline; filename="receipt-${receiptData.orderNumber}.html"`,
        },
      });
    }

    // Try to generate actual PDF
    try {
      const pdfBuffer = await generateReceiptPDF(receiptData);

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="receipt-${receiptData.orderNumber}.pdf"`,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch (pdfError) {
      // Fallback to HTML if PDF generation fails
      logger.warn("[RECEIPTS PDF] PDF generation failed, falling back to HTML:", pdfError);

      const html = generateReceiptHTMLForPrint(receiptData);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="receipt-${receiptData.orderNumber}.html"`,
          "X-PDF-Generation": "failed",
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
