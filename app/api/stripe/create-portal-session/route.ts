// Stripe Billing Portal - Let customers manage their subscription
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase";

interface Organization {
  id: string;
  stripe_customer_id?: string | null;
  owner_user_id: string;
}

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Parse request
      const body = await req.json();
      const { organizationId } = body;

      // STEP 4: Validate inputs
      if (!organizationId) {
        return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
      }

      // STEP 5: Security - Verify user owns organization
      const supabase = await createClient();

      // Get organization
      const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .eq("owner_user_id", user.id)
        .single();

      const typedOrg = org as unknown as Organization | null;

      if (!typedOrg) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }

      // If no Stripe customer ID, try to find it from subscriptions
      let stripeCustomerId = typedOrg.stripe_customer_id;
      
      if (!stripeCustomerId) {
        // Try to find customer from active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          limit: 10,
        });
        
        // Find subscription with matching organization_id in metadata
        const matchingSub = subscriptions.data.find(
          (sub) => sub.metadata?.organization_id === organizationId
        );
        
        if (matchingSub?.customer) {
          stripeCustomerId = typeof matchingSub.customer === "string" 
            ? matchingSub.customer 
            : matchingSub.customer.id;
          
          // Update organization with customer ID
          await supabase
            .from("organizations")
            .update({ stripe_customer_id: stripeCustomerId })
            .eq("id", organizationId);
        }
      }
      
      if (!stripeCustomerId) {
        logger.error("[STRIPE PORTAL] No Stripe customer found", {
          organizationId,
          userId: user.id,
        });
        return NextResponse.json(
          { 
            error: "No billing account found",
            message: "Please contact support to set up your billing account."
          }, 
          { status: 400 }
        );
      }

      // STEP 6: Business logic
      // Create Stripe billing portal session
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "https://servio-production.up.railway.app";

      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${baseUrl}/dashboard`,
      });

      // STEP 7: Return success response
      return NextResponse.json({
        url: session.url,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[STRIPE PORTAL] Unexpected error:", {
        error: errorMessage,
        stack: errorStack,
        userId: context.user.id,
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: process.env.NODE_ENV === "development" ? errorMessage : "Request processing failed",
          ...(process.env.NODE_ENV === "development" && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
