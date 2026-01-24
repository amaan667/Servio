import { createApiHandler } from "@/lib/api/production-handler";
import { stripeService } from "@/lib/services/StripeService";
import { z } from "zod";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  amount: z.number().min(0.5, "Amount must be at least £0.50"),
  venue_id: z.string(),
  venue_name: z.string().optional(),
  table_number: z.union([z.string(), z.number()]).optional(),
  order_id: z.string(),
  customer_name: z.string().optional().default("Customer"),
  customer_email: z.string().email().optional(),
  items: z.array(z.any()).optional(),
  source: z.string().optional().default("qr"),
  qr_type: z.string().optional().default("TABLE_FULL_SERVICE"),
});

/**
 * POST: Create a Stripe Checkout Session for a QR order
 */
export const POST = createApiHandler(
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
      orderId: body.order_id,
      customerName: body.customer_name,
      customerEmail: body.customer_email,
      items: body.items,
      source: body.source,
      qrType: body.qr_type,
      successUrl: `${base}/payment/success?session_id={CHECKOUT_SESSION_ID}&orderId=${body.order_id}`,
      cancelUrl: `${base}/payment/cancel?orderId=${body.order_id}&venueId=${body.venue_id}&tableNumber=${body.table_number || "1"}`,
    });

    return { id: session.id, url: session.url };
  },
  {
    schema: checkoutSchema,
    requireAuth: false, // Public QR checkout
    enforceIdempotency: true,
    autoCase: true,
  }
);
