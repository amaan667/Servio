// Debug API endpoint to check and manually update subscription status
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-client";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log('[DEBUG] Fetching subscription status for user:', user.id);

    // Try multiple approaches to get organization info
    let orgFound = false;
    let org = null;
    
    // Approach 1: Try user_venue_roles table
    try {
      const { data: userVenueRoles, error: userVenueError } = await supabase
        .from('user_venue_roles')
        .select('organization_id, organizations(*)')
        .eq('user_id', user.id);

      console.log('[DEBUG] User venue roles query result:', { userVenueRoles, userVenueError });

      if (!userVenueError && userVenueRoles && userVenueRoles.length > 0) {
        const userVenueRole = userVenueRoles[0];
        if (userVenueRole && userVenueRole.organizations) {
          org = userVenueRole.organizations;
          orgFound = true;
        }
      }
    } catch (error) {
      console.log('[DEBUG] user_venue_roles query failed:', error);
    }

    // Approach 2: Try organizations table directly
    if (!orgFound) {
      try {
        const { data: directOrgs, error: directError } = await supabase
          .from('organizations')
          .select('*')
          .eq('owner_id', user.id)
          .single();
        
        console.log('[DEBUG] Direct organization query result:', { directOrgs, directError });
        
        if (!directError && directOrgs) {
          org = directOrgs;
          orgFound = true;
        }
      } catch (error) {
        console.log('[DEBUG] Direct organizations query failed:', error);
      }
    }

    // Approach 3: Try venues table as fallback (for legacy accounts)
    if (!orgFound) {
      try {
        const { data: venues, error: venueError } = await supabase
          .from('venues')
          .select('venue_id, name, owner_id')
          .eq('owner_id', user.id)
          .limit(1);
        
        console.log('[DEBUG] Venues query result:', { venues, venueError });
        
        if (!venueError && venues && venues.length > 0) {
          // Create a mock organization object for legacy accounts
          org = {
            id: `legacy-${user.id}`,
            owner_id: user.id,
            subscription_tier: 'basic',
            subscription_status: 'basic',
            is_grandfathered: false,
            stripe_customer_id: null,
            stripe_subscription_id: null,
            trial_ends_at: null
          };
          orgFound = true;
        }
      } catch (error) {
        console.log('[DEBUG] Venues query failed:', error);
      }
    }

    if (!orgFound) {
      return NextResponse.json({
        success: false,
        error: "No organization found",
        debug: {
          userId: user.id,
          approaches: ['user_venue_roles', 'direct_organizations', 'venues_fallback']
        }
      });
    }

    // If organization has Stripe subscription ID, fetch from Stripe
    let stripeSubscription = null;
    if (org.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        console.log('[DEBUG] Stripe subscription data:', {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          metadata: stripeSubscription.metadata
        });
      } catch (stripeError) {
        console.error('[DEBUG] Error fetching Stripe subscription:', stripeError);
      }
    }

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        subscription_tier: org.subscription_tier,
        subscription_status: org.subscription_status,
        stripe_subscription_id: org.stripe_subscription_id,
        trial_ends_at: org.trial_ends_at,
        is_grandfathered: org.is_grandfathered
      },
      stripeSubscription: stripeSubscription ? {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        metadata: stripeSubscription.metadata,
        trial_end: stripeSubscription.trial_end
      } : null,
      debug: {
        userId: user.id,
        orgFound,
        approaches: ['user_venue_roles', 'direct_organizations', 'venues_fallback']
      }
    });

  } catch (error: any) {
    console.error("[DEBUG] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to debug subscription status" },
      { status: 500 }
    );
  }
}

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
    const { organizationId, tier, subscriptionStatus, trialEndsAt } = body;

    if (!organizationId || !tier) {
      return NextResponse.json(
        { error: "Organization ID and tier required" },
        { status: 400 }
      );
    }

    console.log('[DEBUG] Manually updating subscription status:', {
      organizationId,
      tier,
      subscriptionStatus,
      trialEndsAt
    });

    // Update organization with provided data
    const updateData = {
      subscription_tier: tier,
      subscription_status: subscriptionStatus || 'trialing',
      trial_ends_at: trialEndsAt || null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", organizationId);

    if (updateError) {
      console.error('[DEBUG] Error updating organization:', updateError);
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    console.log('[DEBUG] Successfully updated organization subscription status');

    return NextResponse.json({
      success: true,
      updated: updateData
    });

  } catch (error: any) {
    console.error("[DEBUG] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update subscription status" },
      { status: 500 }
    );
  }
}
