// Stripe Billing Portal - Let customers manage their subscription
import { NextRequest } from "next/server";
import { stripe } from "@/lib/stripe-client";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase";
import { env, isDevelopment } from "@/lib/env";
import { success, apiErrors, isZodError, handleZodError } from "@/lib/api/standard-response";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation-schemas";

interface Organization {

}

const createPortalSessionSchema = z.object({

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
        
        return apiErrors.notFound("Organization not found or access denied");
      }

      if (!org.stripe_customer_id) {
        return apiErrors.badRequest("No Stripe customer ID found for this organization");
      }

      // STEP 5: Business logic - Create portal session
      const portalSession = await stripe.billingPortal.sessions.create({

        return_url: `${env("NEXT_PUBLIC_APP_URL") || env("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000"}/settings/billing`,

      // STEP 6: Return success response
      return success({

    } catch (error) {

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

  }
);
