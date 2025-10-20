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
      data: { user },
    } = await supabase.auth.getUser();

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
      .eq("owner_id", user.id)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Grandfathered accounts don't need billing portal
    if (org.is_grandfathered) {
      return NextResponse.json(
        { error: "Grandfathered accounts don't have billing management" },
        { status: 400 }
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
    logger.debug('[STRIPE PORTAL] Return URL:', returnUrl);
    
    // Try to get or create a billing portal configuration
    let configurationId: string | undefined;
    
    try {
      // First, try to list existing configurations
      logger.debug('[STRIPE PORTAL] Checking for existing configurations...');
      const configurations = await stripe.billingPortal.configurations.list({ limit: 1 });
      
      if (configurations.data.length > 0 && configurations.data[0].active) {
        configurationId = configurations.data[0].id;
        logger.debug('[STRIPE PORTAL] Using existing configuration:', configurationId);
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
        logger.debug('[STRIPE PORTAL] Created new configuration:', configurationId);
      }
    } catch (configError: any) {
      logger.error('[STRIPE PORTAL] Failed to get/create configuration:', configError);
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
    } catch (portalError: any) {
      logger.error('[STRIPE PORTAL] Failed to create session:', portalError);
      
      // Provide more specific error messages
      if (portalError.code === 'resource_missing') {
        return NextResponse.json(
          { 
            error: 'Customer not found in Stripe. Please contact support to resolve your billing setup.' 
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: portalError.message || 'Failed to create billing portal session. Please try again or contact support.' 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    logger.error("[STRIPE PORTAL] Error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: error.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}

