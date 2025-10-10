// Stripe Billing Portal - Let customers manage their subscription
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-client";

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
    
    console.log('[STRIPE PORTAL] Creating session for customer:', org.stripe_customer_id);
    console.log('[STRIPE PORTAL] Return URL:', returnUrl);
    
    // Try to create portal session with configuration handling
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: returnUrl,
      });

      return NextResponse.json({ url: session.url });
    } catch (portalError: any) {
      // If no configuration exists, create a default one and retry
      if (portalError.message?.includes('No configuration provided') || 
          portalError.message?.includes('default configuration has not been created')) {
        console.log('[STRIPE PORTAL] No configuration found, creating default configuration...');
        
        try {
          // Create a default billing portal configuration
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

          console.log('[STRIPE PORTAL] Created configuration:', configuration.id);

          // Retry creating the portal session with the new configuration
          const session = await stripe.billingPortal.sessions.create({
            customer: org.stripe_customer_id,
            return_url: returnUrl,
            configuration: configuration.id,
          });

          return NextResponse.json({ url: session.url });
        } catch (configError: any) {
          console.error('[STRIPE PORTAL] Failed to create configuration:', configError);
          // Fall back to providing helpful error message
          return NextResponse.json(
            { 
              error: 'Billing portal configuration is missing. Please contact support or set up your billing portal at https://dashboard.stripe.com/settings/billing/portal' 
            },
            { status: 500 }
          );
        }
      }
      
      // Re-throw other errors
      throw portalError;
    }
  } catch (error: any) {
    console.error("[STRIPE PORTAL] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}

