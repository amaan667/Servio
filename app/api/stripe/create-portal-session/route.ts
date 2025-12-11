// Stripe Billing Portal - Let customers manage their subscription
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase";
import { env, isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

interface Organization {
  id: string;
  stripe_customer_id?: string | null;
  owner_user_id: string;
}

const createPortalSessionSchema = z.object({
  organizationId: z.string().uuid("Invalid organization ID"),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      }

      // STEP 2: Get user from context (already verified)
      const user = context.user;

      // STEP 3: Validate input
      const body = await validateBody(createPortalSessionSchema, await req.json());

      // STEP 4: Security - Verify user owns organization
      const supabase = await createClient();

      // Get organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", body.organizationId)
        .eq("owner_user_id", user.id)
        .single();

      if (orgError || !org) {
        logger.warn("[STRIPE PORTAL] Organization not found or access denied", {
          organizationId: body.organizationId,
          userId: user.id,
        });
        return apiErrors.notFound("Organization not found or access denied");
      }

      if (!org.stripe_customer_id) {
        return apiErrors.badRequest("No Stripe customer ID found for this organization");
      }

      // STEP 5: Business logic - Create portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${env("NEXT_PUBLIC_APP_URL") || env("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000"}/settings/billing`,
      });

      logger.info("[STRIPE PORTAL] Portal session created", {
        sessionId: portalSession.id,
        organizationId: body.organizationId,
        userId: user.id,
      });

      // STEP 6: Return success response
      return success({
        url: portalSession.url,
      });
    } catch (error) {
      logger.error("[STRIPE PORTAL] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: context.user.id,
      });

      if (isZodError(error)) {
        return handleZodError(error);
      }

      return apiErrors.internal(
        "Failed to create portal session",
        isDevelopment() ? error : undefined
      );
    }
  },
  {
    // System route - no venue required
    extractVenueId: async () => null,
  }
);
