/**
 * Sync Subscription Tier from Stripe
 * Ensures organization.subscription_tier matches Stripe subscription
 * Uses metadata and product name - NO hardcoded Price IDs needed
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { logger } from "@/lib/logger";
import { getTierFromStripeSubscription } from "@/lib/stripe-tier-helper";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

const syncSubscriptionSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        );
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Validate input
      const body = await validateBody(syncSubscriptionSchema, await req.json());
      const organizationId = body.organizationId;

      // STEP 4: Security - Verify user owns organization
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
        return apiErrors.notFound("Organization not found");
      }

      // Verify user owns organization
      if (org.owner_user_id !== user.id) {
        return apiErrors.notFound("Organization not found or access denied");
      }

      // STEP 5: Business logic
      if (!org.stripe_customer_id) {
        return apiErrors.badRequest("Organization has no Stripe customer ID");
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
            error: updateError.message,
            organizationId,
            userId: user.id,
          });
          return apiErrors.database(
            "Failed to update organization",
            isDevelopment() ? updateError.message : undefined
          );
        }

        return success({
          message: "No active subscription found - set to starter/trialing",
          tier: "starter",
          status: "trialing",
        });
      }

      const subscription = subscriptions.data[0];
      // Get tier directly from Stripe (no normalization)
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
          error: updateError.message,
          organizationId,
          userId: user.id,
        });
        return apiErrors.database(
          "Failed to update organization",
          isDevelopment() ? updateError.message : undefined
        );
      }

      logger.info("[SUBSCRIPTION SYNC] Subscription synced successfully", {
        organizationId,
        tier,
        status: subscription.status,
        userId: user.id,
      });

      // STEP 6: Return success response
      return success({
        message: "Subscription synced successfully",
        tier,
        status: subscription.status,
      });
    } catch (error) {
      logger.error("[SUBSCRIPTION SYNC] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Request processing failed",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
