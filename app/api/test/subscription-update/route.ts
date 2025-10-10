// Test API to manually update subscription status
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { tier = 'standard', status = 'trialing' } = body;

    console.log('[TEST] Manually updating subscription status for user:', user.id);

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
        if (userVenueRole && userVenueRole.organizations) {
          orgId = userVenueRole.organizations.id;
          orgFound = true;
        }
      }
    } catch (error) {
      console.log('[TEST] user_venue_roles query failed:', error);
    }

    // Approach 2: Try organizations table directly
    if (!orgFound) {
      try {
        const { data: directOrgs, error: directError } = await supabase
          .from('organizations')
          .select('*')
          .eq('owner_id', user.id)
          .single();
        
        if (!directError && directOrgs) {
          orgId = directOrgs.id;
          orgFound = true;
        }
      } catch (error) {
        console.log('[TEST] Direct organizations query failed:', error);
      }
    }

    // Approach 3: Create organization if none exists
    if (!orgFound) {
      try {
        const { data: newOrg, error: createError } = await supabase
          .from('organizations')
          .insert({
            owner_id: user.id,
            subscription_tier: tier,
            subscription_status: status,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('[TEST] Error creating organization:', createError);
          return NextResponse.json(
            { error: "Failed to create organization" },
            { status: 500 }
          );
        }

        orgId = newOrg.id;
        orgFound = true;
        console.log('[TEST] Created new organization:', orgId);
      } catch (error) {
        console.error('[TEST] Error creating organization:', error);
        return NextResponse.json(
          { error: "Failed to create organization" },
          { status: 500 }
        );
      }
    }

    // Update organization with subscription details
    const updateData = {
      subscription_tier: tier,
      subscription_status: status,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[TEST] Updating organization with data:', updateData);

    const { error: updateError } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", orgId);

    if (updateError) {
      console.error('[TEST] Error updating organization:', updateError);
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    console.log('[TEST] Successfully updated organization subscription status');

    return NextResponse.json({
      success: true,
      organizationId: orgId,
      updated: updateData
    });

  } catch (error: any) {
    console.error("[TEST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update subscription status" },
      { status: 500 }
    );
  }
}
