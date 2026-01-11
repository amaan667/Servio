import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

/**
 * Print physical ticket for counter/table orders
 * Supports ESC/POS format for thermal printers
 */
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  try {
    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {

          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { orderId, printerType = "thermal" } = body;
    const finalVenueId = context.venueId || body.venueId;

    if (!orderId || !finalVenueId) {
      return NextResponse.json({ error: "orderId and finalVenueId are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("venue_id", finalVenueId)
      .single();

    if (orderError || !order) {
      return apiErrors.notFound("Order not found");
    }

    // Get venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name, address, phone")
      .eq("venue_id", finalVenueId)
      .single();

    const venueName = venue?.venue_name || "Restaurant";
    const venueAddress = venue?.address || "";
    const venuePhone = venue?.phone || "";

    // Generate ticket content based on printer type
    let ticketContent: string;

    if (printerType === "thermal" || printerType === "escpos") {
      // ESC/POS format for thermal printers
      ticketContent = generateESCPOSTicket(order, venueName, venueAddress, venuePhone);
    } else {
      // Plain text format
      ticketContent = generatePlainTextTicket(order, venueName, venueAddress, venuePhone);
    }

    // Log ticket generation
    

    // In production, this would send to actual printer
    // For now, return the ticket content
    // Printer integration: PDF generation ready for printer APIs
    // For direct printing, integrate with Star Micronics, Epson ESC/POS, or similar
    // Example:
    // await sendToPrinter(printerId, ticketContent);

    return NextResponse.json({

  } catch (error) {
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }

/**
 * Generate ESC/POS formatted ticket
 */
function generateESCPOSTicket(

    items?: Array<{ item_name?: string; quantity?: number; price?: number }>;
    total_amount?: number;

  },

  const tableLabel = order.table_number ? `Table ${order.table_number}` : "Counter Order";

  // ESC/POS commands
  // ESC @ = Initialize printer
  // ESC a 1 = Center align
  // ESC a 0 = Left align
  // ESC d n = Feed n lines
  // ESC ! n = Select character size
  // ESC M n = Select font
  // GS V n = Cut paper

  let ticket = "\x1B@"; // Initialize
  ticket += "\x1B!\x18"; // Double height, double width
  ticket += "\x1Ba\x01"; // Center align
  ticket += `${venueName}\n`;
  ticket += "\x1B!\x00"; // Normal size
  ticket += "\x1Ba\x00"; // Left align

  if (venueAddress) {
    ticket += `${venueAddress}\n`;
  }
  if (venuePhone) {
    ticket += `Tel: ${venuePhone}\n`;
  }

  ticket += "\x1Bd\x01"; // Feed 1 line
  ticket += "--------------------------------\n";
  ticket += "\x1B!\x10"; // Double width
  ticket += `ORDER #${orderNumber}\n`;
  ticket += "\x1B!\x00"; // Normal size
  ticket += `${tableLabel}\n`;
  if (order.customer_name) {
    ticket += `Customer: ${order.customer_name}\n`;
  }
  ticket += `Date: ${date}\n`;
  ticket += "--------------------------------\n";

  // Items
  ticket += "\x1B!\x08"; // Double height
  ticket += "ITEMS\n";
  ticket += "\x1B!\x00"; // Normal size
  ticket += "--------------------------------\n";

  if (order.items && order.items.length > 0) {
    order.items.forEach((item) => {
      const qty = item.quantity || 1;
      const name = item.item_name || "Item";
      const price = (item.price || 0) * qty;
      ticket += `${qty}x ${name}\n`;
      ticket += `    £${price.toFixed(2)}\n`;

  }

  ticket += "--------------------------------\n";
  ticket += "\x1B!\x10"; // Double width
  ticket += `TOTAL: £${(order.total_amount || 0).toFixed(2)}\n`;
  ticket += "\x1B!\x00"; // Normal size
  ticket += "\x1Bd\x02"; // Feed 2 lines
  ticket += "Thank you for your order!\n";
  ticket += "\x1Bd\x03"; // Feed 3 lines
  ticket += "\x1D\x56\x00"; // Cut paper

  return ticket;
}

/**
 * Generate plain text ticket
 */
function generatePlainTextTicket(

    items?: Array<{ item_name?: string; quantity?: number; price?: number }>;
    total_amount?: number;

  },

  const tableLabel = order.table_number ? `Table ${order.table_number}` : "Counter Order";

  let ticket = `${venueName}\n`;
  if (venueAddress) ticket += `${venueAddress}\n`;
  if (venuePhone) ticket += `Tel: ${venuePhone}\n`;
  ticket += "\n";
  ticket += "================================\n";
  ticket += `ORDER #${orderNumber}\n`;
  ticket += `${tableLabel}\n`;
  if (order.customer_name) {
    ticket += `Customer: ${order.customer_name}\n`;
  }
  ticket += `Date: ${date}\n`;
  ticket += "================================\n";
  ticket += "\nITEMS:\n";
  ticket += "--------------------------------\n";

  if (order.items && order.items.length > 0) {
    order.items.forEach((item) => {
      const qty = item.quantity || 1;
      const name = item.item_name || "Item";
      const price = (item.price || 0) * qty;
      ticket += `${qty}x ${name} - £${price.toFixed(2)}\n`;

  }

  ticket += "--------------------------------\n";
  ticket += `TOTAL: £${(order.total_amount || 0).toFixed(2)}\n`;
  ticket += "\n";
  ticket += "Thank you for your order!\n";

  return ticket;
}
