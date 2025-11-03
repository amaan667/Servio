// Stripe Billing Portal - Let customers manage their subscription
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { authenticateRequest } from "@/lib/api-auth";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from "@/lib/logger";

export async function POST(_request: NextRequest) {
  try {
    // Authenticate using Authorization header
    const auth = await authenticateRequest(_request);
    if (!auth.success || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { user, supabase } = auth;

    const body = await _request.json();
    const { organizationId, venueId } = body;

    // Get organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .eq("owner_user_id", user.id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!(org as any).stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found" }, { status: 400 });
    }

    // Create billing portal session
    // Return to settings page - use venueId from request if provided
    const returnUrl = venueId
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "https://servio-production.up.railway.app"}/dashboard/${venueId}/settings`
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
        customer: (org as any).stripe_customer_id,
        return_url: returnUrl,
      };

      if (configurationId) {
        sessionParams.configuration = configurationId;
      }

      logger.debug("[STRIPE PORTAL] Creating session with params:", {
        customer: (org as any).stripe_customer_id,
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
