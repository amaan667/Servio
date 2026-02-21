import { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe-client";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { z } from "zod";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";

export const runtime = "nodejs";

const createIntentSchema = z.object({
  cartId: z.string().min(1, "Cart ID is required"),
  venueId: z.string().uuid("Invalid venue ID").optional(),
  tableNumber: z.number().int().positive("Table number must be positive"),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
        specialInstructions: z.string().optional(),
      })
    )
    .min(1, "At least one item is required"),
  totalAmount: z.number().int().positive().min(50, "Amount too small (minimum £0.50)"),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  receiptEmail: z.string().email("Invalid email address").optional(),
});

export const POST = createUnifiedHandler(
  async (req: NextRequest, context) => {
    const correlationId = getCorrelationIdFromRequest(req);
    const body = context.body as z.infer<typeof createIntentSchema>;
    const finalVenueId = context.venueId || body.venueId;

    if (!finalVenueId) {
      throw new Error("venueId is required");
    }

    const { cartId, tableNumber, items, totalAmount, customerName, customerPhone, receiptEmail } =
      body;

    // Cart data stored in metadata
    const itemsSummary = items.map((item) => `${item.name} x${item.quantity}`).join(", ");

    // Create payment intent with idempotency key
    // CRITICAL: Include correlation_id in metadata for traceability
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: totalAmount,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      metadata: {
        cart_id: cartId,
        venue_id: finalVenueId,
        table_number: tableNumber.toString(),
        customer_name: customerName,
        customer_phone: customerPhone,
        item_count: items.length.toString(),
        items_summary: itemsSummary.substring(0, 500), // Limit metadata size
        total_amount: totalAmount.toString(),
        correlation_id: correlationId, // CRITICAL: For tracing payments to orders
      },
      description: `Order for ${customerName} at table ${tableNumber}`,
    };

    // Add receipt email if provided - Stripe will automatically send digital receipts
    if (receiptEmail && receiptEmail.trim() !== "") {
      paymentIntentParams.receipt_email = receiptEmail.trim();
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams, {
      idempotencyKey: `pi_${cartId}`,
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  },
  {
    schema: createIntentSchema,
    requireAuth: true,
    requireVenueAccess: true,
    venueIdSource: "body",
    enforceIdempotency: true, // Critical for payment operations to prevent double-charging
    rateLimit: {
      window: 60, // 60 seconds (1 minute)
      limit: 20, // 20 requests per minute
    },
  }
);
