import { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';
import { getCorrelationIdFromRequest } from '@/lib/middleware/correlation-id';

export const runtime = "nodejs";

const createIntentSchema = z.object({
  cartId: z.string().min(1, "Cart ID is required"),
  venueId: z.string().uuid("Invalid venue ID").optional(),
  tableNumber: z.number().int().positive("Table number must be positive"),
  items: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    price: z.number().positive(),
    quantity: z.number().int().positive(),
    specialInstructions: z.string().optional(),
  })).min(1, "At least one item is required"),
  totalAmount: z.number().int().positive().min(50, "Amount too small (minimum £0.50)"),
  customerName: z.string().min(1).max(100),
  customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  receiptEmail: z.string().email("Invalid email address").optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const correlationId = getCorrelationIdFromRequest(req);
    
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Validate input
      const body = await validateBody(createIntentSchema, await req.json());
      const finalVenueId = context.venueId || body.venueId;

      if (!finalVenueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Business logic
      const {
        cartId,
        tableNumber,
        items,
        totalAmount,
        customerName,
        customerPhone,
        receiptEmail,
      } = body;

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

      logger.info("[PAYMENT INTENT] Payment intent created successfully", {
        paymentIntentId: paymentIntent.id,
        venueId: finalVenueId,
        amount: totalAmount,
        userId: context.user.id,
        correlationId, // CRITICAL: Include correlation ID in logs
      });

      // STEP 4: Return success response
      return success({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      logger.error("[PAYMENT INTENT] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        venueId: context.venueId,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      if (error instanceof Stripe.errors.StripeError) {
        return apiErrors.badRequest(error.message);
      }

      return apiErrors.internal(
        "Failed to create payment intent",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // Extract venueId from body
    extractVenueId: async (req) => {
      try {
        const body = await req.json().catch(() => ({}));
        return (body as { venueId?: string; venue_id?: string })?.venueId || 
               (body as { venueId?: string; venue_id?: string })?.venue_id || 
               null;
      } catch {
        return null;
      }
    },
  }
);
