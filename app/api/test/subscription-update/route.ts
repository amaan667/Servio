import { errorToContext } from '@/lib/utils/error-to-context';
// Test API to manually update subscription status
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { apiLogger, logger } from '@/lib/logger';

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
    const { tier, status = 'trialing' } = body;

    logger.debug('[TEST] Manually updating subscription status for user:', user.id);

    // If no tier provided, try to detect from Stripe
    let detectedTier = tier;
    if (!detectedTier) {
      // Try to find existing organization first to get Stripe subscription ID
      let existingOrg = null;
      
      // Check for existing organization
      const { data: existingOrgs, error: existingError } = await supabase
        .from('organizations')
        .select('stripe_subscription_id')
        .eq('owner_user_id', user.id)
        .single();
      
      if (!existingError && existingOrgs?.stripe_subscription_id) {
        try {
          // Fetch subscription from Stripe to get the actual tier
          const stripe = require('@/lib/stripe-client').stripe;
          const stripeSubscription = await stripe.subscriptions.retrieve(existingOrgs.stripe_subscription_id);
          detectedTier = stripeSubscription.metadata?.tier || 'basic';
          logger.debug('[TEST] Detected tier from Stripe:', { value: detectedTier });
        } catch (stripeError) {
          logger.error('[TEST] Error fetching from Stripe:', { value: stripeError });
          detectedTier = 'basic'; // Default fallback
        }
      } else {
        detectedTier = 'basic'; // Default fallback
      }
    }

    // Try to find organization
    let orgId = null;
    let orgFound = false;

    // Approach 1: Try user_venue_roles table
    try {
      const { data: userVenueRoles, error: userVenueError } = await supabase
        .from('user_venue_roles')
        .select('organization_id, organizations(*)')
        .eq('user_id', user.id);

      if (!userVenueError && userVenueRoles && userVenueRoles.length > 0) {
        const userVenueRole = userVenueRoles[0];
        if (userVenueRole && userVenueRole.organization_id) {
          orgId = userVenueRole.organization_id;
          orgFound = true;
        }
      }
    } catch (error) {
      logger.debug('[TEST] user_venue_roles query failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Approach 2: Try organizations table directly
    if (!orgFound) {
      try {
        const { data: directOrgs, error: directError } = await supabase
          .from('organizations')
          .select('*')
          .eq('owner_user_id', user.id)
          .single();
        
        if (!directError && directOrgs) {
          orgId = directOrgs.id;
          orgFound = true;
        }
      } catch (error) {
        logger.debug('[TEST] Direct organizations query failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Approach 3: Create organization if none exists
    if (!orgFound) {
      try {
        const { data: newOrg, error: createError } = await supabase
          .from('organizations')
          .insert({
            owner_id: user.id,
            subscription_tier: detectedTier,
            subscription_status: status,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          logger.error('[TEST] Error creating organization:', { value: createError });
          return NextResponse.json(
            { error: "Failed to create organization" },
            { status: 500 }
          );
        }

        orgId = newOrg.id;
        orgFound = true;
        logger.debug('[TEST] Created new organization:', { value: orgId });
      } catch (error) {
        logger.error('[TEST] Error creating organization:', { error: error instanceof Error ? error.message : 'Unknown error' });
        return NextResponse.json(
          { error: "Failed to create organization" },
          { status: 500 }
        );
      }
    }

    // Update organization with subscription details
    const updateData = {
      subscription_tier: detectedTier,
      subscription_status: status,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    logger.debug('[TEST] Updating organization with data:', { value: updateData });

    const { error: updateError } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", orgId);

    if (updateError) {
      logger.error('[TEST] Error updating organization:', { value: updateError });
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    logger.debug('[TEST] Successfully updated organization subscription status');

    return NextResponse.json({
      success: true,
      organizationId: orgId,
      updated: updateData
    });

  } catch (error: any) {
    logger.error("[TEST] Error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: error.message || "Failed to update subscription status" },
      { status: 500 }
    );
  }
}
