// Fetch Stripe Checkout Session Details
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Fetch session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Return session details
    return NextResponse.json({
      id: session.id,
      customer_email: session.customer_email,
      metadata: session.metadata,
      subscription: session.subscription,
      payment_status: session.payment_status,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("[STRIPE SESSION] Error fetching session:", { error: errorMessage });
    return NextResponse.json(
      { error: errorMessage || "Failed to fetch session" },
      { status: 500 }
    );
  }
}

