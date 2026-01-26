import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { stripeService } from "@/lib/services/StripeService";
import { createSupabaseClient } from "@/lib/supabase";
import { z } from "zod";
import { apiErrors } from "@/lib/api/standard-response";

export const runtime = "nodejs";

const createCheckoutSchema = z.object({
  tier: z.enum(["starter", "pro", "enterprise"]),
  organizationId: z.string().optional(),
  isSignup: z.boolean().optional().default(false),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
  venueName: z.string().optional(),
});

/**
 * POST: Create a Stripe Checkout Session for subscription
 */
export const POST = createUnifiedHandler(
  async (_req, context) => {
    const { body, user } = context;
    const priceIds = await stripeService.getTierPriceIds();
    const priceId = priceIds[body.tier];

    if (!priceId) {
      return apiErrors.badRequest(`No Stripe Price ID found for tier: ${body.tier}`);
    }

    // 1. Handle New Signup Flow (no auth required)
    if (body.isSignup) {
      const session = await stripeService.createSubscriptionSession({
        priceId,
        tier: body.tier,
        isSignup: true,
        customerEmail: body.email,
        metadata: {
          full_name: body.fullName || "",
          venue_name: body.venueName || "",
        }
      });

      return { sessionId: session.id, url: session.url };
    }

    // 2. Handle Existing User Upgrade (auth required)
    if (!user || !user.id) {
      return apiErrors.unauthorized("Authentication required for upgrades");
    }

    const supabase = await createSupabaseClient();
    
    // Get or Create Organization
    let { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!org) {
      const { data: newOrg, error: createError } = await supabase
        .from("organizations")
        .insert({
          owner_user_id: user.id,
          subscription_tier: "starter",
          subscription_status: "trialing",
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("*")
        .single();

      if (createError) throw createError;
      org = newOrg;
    }

    // Get or Create Stripe Customer
    const customerId = await stripeService.getOrCreateCustomer(org!, {
      id: user.id,
      email: user.email || "",
    });
    
    // Update org if customer ID was just created
    if (customerId !== org!.stripe_customer_id) {
      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", org!.id);
    }

    // Create Session
    const session = await stripeService.createSubscriptionSession({
      customerId,
      priceId,
      tier: body.tier,
      orgId: org!.id,
      userId: user.id,
      isSignup: false,
    });

    return { sessionId: session.id, url: session.url };
  },
  {
    schema: createCheckoutSchema,
    requireAuth: false, // Explicitly handle auth in the handler for signup flow
    enforceIdempotency: true, // Crucial for payments
  }
);
