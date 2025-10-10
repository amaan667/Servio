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
    const { tier } = body;

    if (!tier || !["basic", "standard", "premium"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier" },
        { status: 400 }
      );
    }

    // Find user's organization
    let org = null;

    // Try user_venue_roles first
    const { data: userVenueRole } = await supabase
      .from('user_venue_roles')
      .select('organization_id, organizations(*)')
      .eq('user_id', user.id)
      .single();

    if (userVenueRole && userVenueRole.organizations) {
      org = userVenueRole.organizations;
    } else {
      // Try direct organization lookup
      const { data: directOrg } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', user.id)
        .single();
      
      org = directOrg;
    }

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Update the organization tier
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        subscription_tier: tier,
        subscription_status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Plan updated to ${tier}`,
      organization: {
        id: org.id,
        subscription_tier: tier,
        subscription_status: 'trialing'
      }
    });

  } catch (error) {
    console.error('Test update plan error:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
