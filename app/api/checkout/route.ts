import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { stripeService } from "@/lib/services/StripeService";
import { z } from "zod";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  amount: z.number().min(0.5, "Amount must be at least £0.50"),
  venue_id: z.string(),
  venue_name: z.string().optional(),
  table_number: z.union([z.string(), z.number()]).optional(),
  order_id: z.string().optional(), // Optional: create order after payment when omitted
  customer_name: z.string().optional().default("Customer"),
  customer_phone: z.string().optional(),
  customer_email: z.string().email().optional().or(z.literal("")),
  items: z.array(z.unknown()).optional(),
  source: z.string().optional().default("qr"),
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

    const session = await stripeService.createOrderCheckoutSession({
      amount: body.amount,
      venueName: body.venue_name || "Restaurant",
      venueId: body.venue_id,
      tableNumber: String(body.table_number || "1"),
      orderId: body.order_id ?? undefined,
      customerName: body.customer_name || "Customer",
      customerPhone: body.customer_phone,
      customerEmail:
        body.customer_email && body.customer_email !== ""
          ? body.customer_email
          : undefined,
      items: body.items,
      source: body.source,
      qrType: body.qr_type,
      successUrl:
        body.order_id != null
          ? `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${body.order_id}`
          : `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:
        body.order_id != null
          ? `${base}/payment/cancel?orderId=${body.order_id}&venueId=${body.venue_id}&tableNumber=${body.table_number || "1"}`
          : `${base}/payment/cancel?venueId=${body.venue_id}&tableNumber=${body.table_number || "1"}`,
    });

    return { id: session.id, url: session.url };
  },
  {
    schema: checkoutSchema,
    requireAuth: false,
    requireVenueAccess: false,
    enforceIdempotency: true,
    autoCase: true,
  }
);
