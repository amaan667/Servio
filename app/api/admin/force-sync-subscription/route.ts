/**
 * Force Sync Subscription from Stripe
 * Call this endpoint to manually sync when database and Stripe are out of sync
 * Uses metadata and product name - NO hardcoded Price IDs needed
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";
import { getTierFromStripeSubscription } from "@/lib/stripe-tier-helper";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';
import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';
import { z } from 'zod';
import { validateBody } from '@/lib/api/validation-schemas';

const forceSyncSchema = z.object({
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

      // STEP 2: Validate input
      const body = await validateBody(forceSyncSchema, await req.json());
      const organizationId = body.organizationId;

      // STEP 3: Business logic
      const supabase = createAdminClient();

      // Get organization's Stripe customer ID
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", organizationId)
        .single();

      if (orgError || !org) {
        logger.error("[FORCE SYNC] Organization not found", {
          organizationId,
          error: orgError?.message,
        });
        return apiErrors.notFound("Organization not found");
      }

      if (!org.stripe_customer_id) {
        logger.warn("[FORCE SYNC] No Stripe customer ID", { organizationId });
        return apiErrors.badRequest("Organization has no Stripe customer ID");
      }

      // Get active subscriptions from Stripe
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
          logger.error("[FORCE SYNC] Error updating organization", { error: updateError });
          return apiErrors.database("Failed to update organization");
        }

        return success({
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
        logger.error("[FORCE SYNC] Error updating organization", { error: updateError });
        return apiErrors.database("Failed to update organization");
      }

      logger.info("[FORCE SYNC] Subscription synced successfully", {
        organizationId,
        tier,
        status: subscription.status,
        userId: context.user.id,
      });

      // STEP 4: Return success response
      return success({
        message: "Subscription synced successfully",
        tier,
        status: subscription.status,
      });
    } catch (error) {
      logger.error("[FORCE SYNC] Unexpected error:", {
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
