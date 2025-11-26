/**
 * Sync Subscription Tier from Stripe
 * Ensures organization.subscription_tier matches Stripe subscription
 * Uses metadata and product name - NO hardcoded Price IDs needed
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { getTierFromStripeSubscription } from "@/lib/stripe-tier-helper";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Parse request
      const { organizationId } = await req.json();

      // STEP 4: Validate inputs
      if (!organizationId) {
        return NextResponse.json({ error: "organizationId required" }, { status: 400 });
      }

      // STEP 5: Security - Verify user owns organization
      const supabase = createAdminClient();

      // Get organization with Stripe customer ID
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, stripe_customer_id, subscription_tier, owner_user_id")
        .eq("id", organizationId)
        .single();

      if (orgError || !org) {
        logger.error("[SUBSCRIPTION SYNC] Organization not found", {
          organizationId,
          error: orgError?.message,
          userId: user.id,
        });
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
      }

      // Verify user owns organization
      if (org.owner_user_id !== user.id) {
        return NextResponse.json(
          { error: "Organization not found or access denied" },
          { status: 404 }
        );
      }

      // STEP 6: Business logic
      if (!org.stripe_customer_id) {
        return NextResponse.json(
          { error: "Organization has no Stripe customer ID" },
          { status: 400 }
        );
      }

      // Get active subscription from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: org.stripe_customer_id,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        // No active subscription - set to starter/trialing
        const { error: updateError } = await supabase
          .from("organizations")
          .update({
            subscription_tier: "starter",
            subscription_status: "trialing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", organizationId);

        if (updateError) {
          logger.error("[SUBSCRIPTION SYNC] Error updating to starter", {
            error: updateError,
            organizationId,
            userId: user.id,
          });
          return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: "No active subscription found - set to starter/trialing",
          tier: "starter",
          status: "trialing",
        });
      }

      const subscription = subscriptions.data[0];
      const tier = await getTierFromStripeSubscription(subscription, stripe);

      // Update organization
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          subscription_tier: tier,
          subscription_status: subscription.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (updateError) {
        logger.error("[SUBSCRIPTION SYNC] Error updating organization", {
          error: updateError,
          organizationId,
          userId: user.id,
        });
        return NextResponse.json({ error: "Failed to update organization" }, { status: 500 });
      }

      // STEP 7: Return success response
      return NextResponse.json({
        success: true,
        message: "Subscription synced successfully",
        tier,
        status: subscription.status,
      });
    } catch (_error) {
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      
      logger.error("[SUBSCRIPTION SYNC] Unexpected error:", {
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
