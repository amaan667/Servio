import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { stripeService } from "@/lib/services/StripeService";
import { z } from "zod";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  // Accept both camelCase and snake_case for compatibility
  amount: z.number().min(0.5, "Amount must be at least £0.50"),
  venueId: z.string().optional(),
  venue_id: z.string().optional(),
  venueName: z.string().optional(),
  venue_name: z.string().optional(),
  tableNumber: z.union([z.string(), z.number()]).optional(),
  table_number: z.union([z.string(), z.number()]).optional(),
  orderId: z.string().optional(),
  order_id: z.string().optional(),
  customerName: z.string().optional().default("Customer"),
  customer_name: z.string().optional().default("Customer"),
  customerPhone: z.string().optional(),
  customer_phone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")), 
  customer_email: z.string().email().optional().or(z.literal("")),
  items: z.array(z.unknown()).optional(),
  source: z.string().optional().default("qr"),
  qrType: z.string().optional().default("TABLE_FULL_SERVICE"),
  qr_type: z.string().optional().default("TABLE_FULL_SERVICE"),
});

/**
 * POST: Create a Stripe Checkout Session for a QR order.
 * Pay Now: when order_id is omitted, no order exists yet; order is created only after
 * payment succeeds (payment success page calls create-from-checkout-session with session_id).
 * Pay Later / existing order: when order_id is provided, webhook marks that order as PAID.
 */
export const POST = createUnifiedHandler(
  async (req, context) => {
    const { body } = context;

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const base = `${protocol}://${host}`;

    // Support both camelCase and snake_case from frontend
    const venueId = body.venueId ?? body.venue_id ?? "";
    const venueName = body.venueName ?? body.venue_name ?? "Restaurant";
    const tableNumber = String(body.tableNumber ?? body.table_number ?? "1");
    const orderId = body.orderId ?? body.order_id;
    const customerName = body.customerName ?? body.customer_name ?? "Customer";
    const customerPhone = body.customerPhone ?? body.customer_phone;
    const customerEmailRaw = body.customerEmail ?? body.customer_email;
    const customerEmail = customerEmailRaw && customerEmailRaw !== "" ? customerEmailRaw : undefined;
    const items = body.items;
    const source = body.source;
    const qrType = body.qrType ?? body.qr_type ?? "TABLE_FULL_SERVICE";

    const session = await stripeService.createOrderCheckoutSession({
      amount: body.amount,
      venueName,
      venueId,
      tableNumber,
      orderId: orderId ?? undefined,
      customerName,
      customerPhone,
      customerEmail,
      items,
      source,
      qrType,
      successUrl:
        orderId != null
          ? `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${orderId}`
          : `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:
        orderId != null
          ? `${base}/payment/cancel?orderId=${orderId}&venueId=${venueId}&tableNumber=${tableNumber}`
          : `${base}/payment/cancel?venueId=${venueId}&tableNumber=${tableNumber}`,
    });

    return { id: session.id, url: session.url };
  },
  {
    schema: checkoutSchema,
    requireAuth: false,
    requireVenueAccess: false,
    enforceIdempotency: true,
    // Removed autoCase: true - schema accepts both casing
  }
);
