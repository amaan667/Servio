// Stripe Billing Portal - Let customers manage their subscription
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId } = body;

    // Get organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .eq("owner_user_id", user.id)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 }
      );
    }

    // Create billing portal session
    const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app'}/dashboard`;
    
    logger.debug('[STRIPE PORTAL] Creating session for customer:', org.stripe_customer_id);
    logger.debug('[STRIPE PORTAL] Return URL:', { value: returnUrl });
    
    // Try to get or create a billing portal configuration
    let configurationId: string | undefined;
    
    try {
      // First, try to list existing configurations
      logger.debug('[STRIPE PORTAL] Checking for existing configurations...');
      const configurations = await stripe.billingPortal.configurations.list({ limit: 1 });
      
      const firstConfig = configurations.data[0];
      if (firstConfig && firstConfig.active) {
        configurationId = firstConfig.id;
        logger.debug('[STRIPE PORTAL] Using existing configuration:', { value: configurationId });
      } else {
        // No active configuration found, create a new one
        logger.debug('[STRIPE PORTAL] No active configuration found, creating default configuration...');
        
        const configuration = await stripe.billingPortal.configurations.create({
          business_profile: {
            headline: 'Manage your Servio subscription',
          },
          features: {
            customer_update: {
              enabled: true,
              allowed_updates: ['email', 'address'],
            },
            invoice_history: {
              enabled: true,
            },
            payment_method_update: {
              enabled: true,
            },
            subscription_cancel: {
              enabled: true,
              mode: 'at_period_end',
            },
            subscription_update: {
              enabled: true,
              default_allowed_updates: ['price', 'quantity', 'promotion_code'],
              proration_behavior: 'create_prorations',
            },
          },
        });

        configurationId = configuration.id;
        logger.debug('[STRIPE PORTAL] Created new configuration:', { value: configurationId });
      }
    } catch (configError: unknown) {
      logger.error('[STRIPE PORTAL] Failed to get/create configuration:', { value: configError });
      // Continue without configuration - Stripe will use default if available
      logger.debug('[STRIPE PORTAL] Continuing without explicit configuration...');
    }

    // Create billing portal session
    try {
      const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
        customer: org.stripe_customer_id,
        return_url: returnUrl,
      };
      
      if (configurationId) {
        sessionParams.configuration = configurationId;
      }
      
      logger.debug('[STRIPE PORTAL] Creating session with params:', { 
        customer: org.stripe_customer_id, 
        configuration: configurationId || 'default' 
      });
      
      const session = await stripe.billingPortal.sessions.create(sessionParams);

      return NextResponse.json({ url: session.url });
    } catch (portalError: unknown) {
      logger.error('[STRIPE PORTAL] Failed to create session:', { value: portalError });
      
      const errorMessage = portalError instanceof Error ? portalError.message : 'Unknown error';
      const errorCode = portalError && typeof portalError === 'object' && 'code' in portalError ? String(portalError.code) : undefined;
      
      // Provide more specific error messages
      if (errorCode === 'resource_missing') {
        return NextResponse.json(
          { 
            error: 'Customer not found in Stripe. Please contact support to resolve your billing setup.' 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: errorMessage || 'Failed to create billing portal session. Please try again or contact support.' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("[STRIPE PORTAL] Error:", { error: errorMessage });
    return NextResponse.json(
      { error: errorMessage || "Failed to create portal session" },
      { status: 500 }
    );
  }
}

