// Fetch Stripe Checkout Session Details
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";

export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(_request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return apiErrors.badRequest("Session ID is required");
    }

    // Fetch session from Stripe with expanded customer data
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer"],
    });

    if (!session) {
      return apiErrors.notFound("Session not found");
    }

    // Get email from session or customer object
    let customerEmail: string | null | undefined = session.customer_email;
    if (!customerEmail && session.customer) {
      const customer =
        typeof session.customer === "string"
          ? await stripe.customers.retrieve(session.customer)
          : session.customer;
      // Check if customer is deleted or has email property
      if (customer && !customer.deleted && "email" in customer) {
        const email = (customer as { email?: string | null }).email;
        customerEmail = email ?? undefined;
      }
    }

    logger.debug("[STRIPE SESSION] Retrieved session:", {
      sessionId,
      customerEmail,
      hasMetadata: !!session.metadata,
      metadata: session.metadata,
    });

    // Return session details
    return NextResponse.json({
      id: session.id,
      customer_email: customerEmail,
      metadata: session.metadata,
      subscription: session.subscription,
      payment_status: session.payment_status,
    });
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown _error";
    logger.error("[STRIPE SESSION] Error fetching session:", { error: errorMessage });
    return apiErrors.internal("Failed to fetch session");
  }
}
