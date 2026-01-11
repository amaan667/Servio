import { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe-client";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";
import { getCorrelationIdFromRequest } from "@/lib/middleware/correlation-id";

export const runtime = "nodejs";

const createIntentSchema = z.object({
  cartId: z.string().min(1, "Cart ID is required"),

    )
    .min(1, "At least one item is required"),
  totalAmount: z.number().int().positive().min(50, "Amount too small (minimum £0.50)"),

  customerPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const correlationId = getCorrelationIdFromRequest(req);

    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Validate input
      const body = await validateBody(createIntentSchema, await req.json());
      const finalVenueId = context.venueId || body.venueId;

      if (!finalVenueId) {
        return apiErrors.badRequest("venueId is required");
      }

      // STEP 3: Business logic
      const { cartId, tableNumber, items, totalAmount, customerName, customerPhone, receiptEmail } =
        body;

      // Cart data stored in metadata
      const itemsSummary = items.map((item) => `${item.name} x${item.quantity}`).join(", ");

      // Create payment intent with idempotency key
      // CRITICAL: Include correlation_id in metadata for traceability
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {

        automatic_payment_methods: { enabled: true },

          items_summary: itemsSummary.substring(0, 500), // Limit metadata size

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

      // STEP 4: Return success response
      return success({

    } catch (error) {

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

        const body = await req.json().catch(() => ({}));
        return (
          (body as { venueId?: string; venue_id?: string })?.venueId ||
          (body as { venueId?: string; venue_id?: string })?.venue_id ||
          null
        );
      } catch {
        return null;
      }
    },
  }
);
