import { errorToContext } from '@/lib/utils/error-to-context';
// Debug API endpoint to check and manually update subscription status
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { stripe } from "@/lib/stripe-client";
import { apiLogger as logger } from '@/lib/logger';

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

    logger.debug('[DEBUG] Fetching subscription status for user:', user.id);

    // Try multiple approaches to get organization info
    let orgFound = false;
    let org = null;
    
    // Approach 1: Try user_venue_roles table
    try {
      const { data: userVenueRoles, error: userVenueError } = await supabase
        .from('user_venue_roles')
        .select('organization_id, organizations(*)')
        .eq('user_id', user.id);

      logger.debug('[DEBUG] User venue roles query result:', { userVenueRoles, userVenueError });

      if (!userVenueError && userVenueRoles && userVenueRoles.length > 0) {
        const userVenueRole = userVenueRoles[0];
        if (userVenueRole && userVenueRole.organizations) {
          org = userVenueRole.organizations;
          orgFound = true;
        }
      }
    } catch (error) {
      logger.debug('[DEBUG] user_venue_roles query failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Approach 2: Try organizations table directly
    if (!orgFound) {
      try {
        const { data: directOrgs, error: directError } = await supabase
          .from('organizations')
          .select('*')
          .eq('owner_user_id', user.id)
          .single();
        
        logger.debug('[DEBUG] Direct organization query result:', { directOrgs, directError });
        
        if (!directError && directOrgs) {
          org = directOrgs;
          orgFound = true;
        }
      } catch (error) {
        logger.debug('[DEBUG] Direct organizations query failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Approach 3: If no organization exists, create a real one
    if (!orgFound) {
      logger.debug('[DEBUG] No organization found, creating real organization for user:', user.id);
      try {
        const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
        const { data: newOrg, error: createError } = await supabase
          .from("organizations")
          .insert({
            name: `${userName}'s Organization`,
            slug: `org-${user.id.slice(0, 8)}-${Date.now()}`,
            owner_id: user.id,
            subscription_tier: "basic",
            subscription_status: "trialing",
            is_grandfathered: false,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select("*")
          .single();

        if (createError) {
          logger.error('[DEBUG] Failed to create organization:', { value: createError });
        } else {
          org = newOrg;
          orgFound = true;
          logger.debug('[DEBUG] Created new organization:', org.id);
          
          // Link unknown existing venues to this organization
          await supabase
            .from("venues")
            .update({ organization_id: org.id })
            .eq("owner_id", user.id)
            .is("organization_id", null);
        }
      } catch (error) {
        logger.debug('[DEBUG] Error creating organization:', { error: error instanceof Error ? error.message : 'Unknown error' });
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
        logger.debug('[DEBUG] Stripe subscription data:', {
          id: stripeSubscription.id,
          status: stripeSubscription.status,
          metadata: stripeSubscription.metadata
        });
      } catch (stripeError) {
        logger.error('[DEBUG] Error fetching Stripe subscription:', { value: stripeError });
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

  } catch (error: unknown) {
    logger.error("[DEBUG] Error:", { error: error instanceof Error ? error.message : 'Unknown error' });
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

    logger.debug('[DEBUG] Manually updating subscription status:', {
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
      logger.error('[DEBUG] Error updating organization:', { value: updateError });
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    logger.debug('[DEBUG] Successfully updated organization subscription status');

    return NextResponse.json({
      success: true,
      updated: updateData
    });

  } catch (error: unknown) {
    logger.error("[DEBUG] Error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: error.message || "Failed to update subscription status" },
      { status: 500 }
    );
  }
}
