// Stripe Billing Portal - Let customers manage their subscription
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";
import { requireAuthForAPI, requireVenueAccessForAPI } from "@/lib/auth/api";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase";

interface Organization {
  id: string;
  stripe_customer_id?: string | null;
  owner_user_id: string;
}

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: Authentication check
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: "Unauthorized", message: authResult.error || "Authentication required" },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
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

    const body = await req.json();
    const { organizationId, venueId: venueIdFromBody } = body;

    const user = authResult.user;
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

    if (!typedOrg.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    }

    // Create billing portal session
    // Return to settings page - use venueId from request if provided
    const finalVenueId = venueIdFromBody || organizationId;
    const returnUrl = finalVenueId
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app"}/dashboard/${finalVenueId}/settings`
      : `${process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app"}/dashboard`;


    // Try to get or create a billing portal configuration
    let configurationId: string | undefined;

    try {
      // First, try to list existing configurations
      const configurations = await stripe.billingPortal.configurations.list({ limit: 1 });

      const firstConfig = configurations.data[0];
      if (firstConfig && firstConfig.active) {
        configurationId = firstConfig.id;
      } else {
        // No active configuration found, create a new one
        logger.debug(
          "[STRIPE PORTAL] No active configuration found, creating default configuration..."
        );

        const configuration = await stripe.billingPortal.configurations.create({
          business_profile: {
            headline: "Manage your Servio subscription",
          },
          features: {
            customer_update: {
              enabled: true,
              allowed_updates: ["email", "address"],
            },
            invoice_history: {
              enabled: true,
            },
            payment_method_update: {
              enabled: true,
            },
            subscription_cancel: {
              enabled: true,
              mode: "at_period_end",
            },
            subscription_update: {
              enabled: true,
              default_allowed_updates: ["price", "quantity", "promotion_code"],
              proration_behavior: "create_prorations",
            },
          },
        });

        configurationId = configuration.id;
      }
    } catch (configError: unknown) {
      logger.error("[STRIPE PORTAL] Failed to get/create configuration:", { value: configError });
      // Continue without configuration - Stripe will use default if available
    }

    // Create billing portal session
    try {
      const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
        customer: typedOrg.stripe_customer_id!,
        return_url: returnUrl,
      };

      if (configurationId) {
        sessionParams.configuration = configurationId;
      }

      logger.debug("[STRIPE PORTAL] Creating session with params:", {
        customer: typedOrg.stripe_customer_id,
        configuration: configurationId || "default",
      });

      const session = await stripe.billingPortal.sessions.create(sessionParams);

      return NextResponse.json({ url: session.url });
    } catch (portalError: unknown) {
      logger.error("[STRIPE PORTAL] Failed to create session:", { value: portalError });

      const errorMessage = portalError instanceof Error ? portalError.message : "Unknown error";
      const errorCode =
        portalError && typeof portalError === "object" && "code" in portalError
          ? String(portalError.code)
          : undefined;

      // Provide more specific error messages
      if (errorCode === "resource_missing") {
        return NextResponse.json(
          {
            error:
              "Customer not found in Stripe. Please contact support to resolve your billing setup.",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error:
            errorMessage ||
            "Failed to create billing portal session. Please try again or contact support.",
        },
        { status: 500 }
      );
    }
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : "Unknown _error";
    logger.error("[STRIPE PORTAL] Error:", { error: errorMessage });
    return NextResponse.json(
      { error: errorMessage || "Failed to create portal session" },
      { status: 500 }
    );
  }
}
