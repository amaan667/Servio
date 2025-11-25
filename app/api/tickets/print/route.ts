import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Print physical ticket for counter/table orders
 * Supports ESC/POS format for thermal printers
 */
export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI();
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { orderId, printerType = "thermal"  } = body;
    const finalVenueId = venueId || body.venueId;

    if (!orderId || !finalVenueId) {
      return NextResponse.json(
        { error: "orderId and finalVenueId are required" },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get venue info
    const { data: venue } = await supabase
      .from("venues")
      .select("venue_name, venue_address, venue_phone")
      .eq("venue_id", finalVenueId)
      .single();

    const venueName = venue?.venue_name || "Restaurant";
    const venueAddress = venue?.venue_address || "";
    const venuePhone = venue?.venue_phone || "";

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
    logger.info("[TICKET PRINT] Generated ticket", {
      orderId,
      finalVenueId,
      printerType,
      length: ticketContent.length,
    });

    // In production, this would send to actual printer
    // For now, return the ticket content
    // TODO: Integrate with printer API (e.g., Star Micronics, Epson, etc.)
    // Example:
    // await sendToPrinter(printerId, ticketContent);

    return NextResponse.json({
      success: true,
      ticket: ticketContent,
      format: printerType,
      note: "Ticket content generated. Integrate with printer API for physical printing.",
    });
  } catch (error) {
    logger.error("[TICKET PRINT] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generate ESC/POS formatted ticket
 */
function generateESCPOSTicket(
  order: {
    id: string;
    table_number?: number | null;
    customer_name?: string;
    items?: Array<{ item_name?: string; quantity?: number; price?: number }>;
    total_amount?: number;
    created_at: string;
  },
  venueName: string,
  venueAddress: string,
  venuePhone: string
): string {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const date = new Date(order.created_at).toLocaleString();
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
    });
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
  order: {
    id: string;
    table_number?: number | null;
    customer_name?: string;
    items?: Array<{ item_name?: string; quantity?: number; price?: number }>;
    total_amount?: number;
    created_at: string;
  },
  venueName: string,
  venueAddress: string,
  venuePhone: string
): string {
  const orderNumber = order.id.slice(-6).toUpperCase();
  const date = new Date(order.created_at).toLocaleString();
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
    });
  }

  ticket += "--------------------------------\n";
  ticket += `TOTAL: £${(order.total_amount || 0).toFixed(2)}\n`;
  ticket += "\n";
  ticket += "Thank you for your order!\n";

  return ticket;
}
