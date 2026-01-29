import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";

import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const printTicketSchema = z.object({
  orderId: z.string().uuid(),
  printerType: z.enum(["thermal", "escpos", "plain"]).optional().default("thermal"),
  venueId: z.string().optional(),
});

/**
 * Print physical ticket for counter/table orders
 * Supports ESC/POS format for thermal printers
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const { body } = context;
    const { orderId, printerType = "thermal" } = body;
    const finalVenueId = context.venueId || body.venueId;

    if (!orderId || !finalVenueId) {
      return apiErrors.badRequest("orderId and venueId are required");
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

    return success({
      success: true,
      ticket: ticketContent,
      format: printerType,
      note: "Ticket content generated. Integrate with printer API for physical printing.",
    });
  },
  {
    schema: printTicketSchema,
    requireVenueAccess: true,
    rateLimit: RATE_LIMITS.GENERAL,
    extractVenueId: async (req) => {
      try {
        const body = await req.clone().json();
        return body?.venueId || null;
      } catch {
        return null;
      }
    },
  }
);

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
