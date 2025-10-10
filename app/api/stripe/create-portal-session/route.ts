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
    
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: returnUrl,
      });

      return NextResponse.json({ url: session.url });
    } catch (portalError: any) {
      console.error('[STRIPE PORTAL] Portal creation error:', portalError);
      
      // Check if it's the configuration error
      if (portalError.message?.includes('No configuration provided') || 
          portalError.message?.includes('default configuration has not been created')) {
        
        // For test mode, we can't create a portal without configuration
        // Return a helpful error message instead of the raw Stripe error
        return NextResponse.json(
          { 
            error: "Billing portal is not configured. Please contact support to manage your subscription, or use the plan switching options above to change your plan immediately." 
          },
          { status: 400 }
        );
      }
      
      // For other errors, re-throw them
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

