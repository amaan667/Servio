// API endpoint to ensure a user has a real organization
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user already has an organization
    const { data: existingOrg, error: orgCheckError } = await supabase
      .from("organizations")
      .select("id, subscription_tier, subscription_status, is_grandfathered, trial_ends_at")
      .eq("owner_id", user.id)
      .maybeSingle();

    // If organization exists, return it with no-cache headers
    if (existingOrg && !orgCheckError) {
      const response = NextResponse.json({
        success: true,
        organization: existingOrg,
        created: false
      });
      
      // Add cache control headers to ensure fresh data
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    }

    // Get user's name for organization name
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    
    // Create organization for the user
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
      .select("id, subscription_tier, subscription_status, is_grandfathered, trial_ends_at")
      .single();

    if (createError) {
      console.error("[ORG ENSURE] Error creating organization:", createError);
      return NextResponse.json(
        { error: "Failed to create organization", details: createError.message },
        { status: 500 }
      );
    }

    // Update any venues to link to this organization
    await supabase
      .from("venues")
      .update({ organization_id: newOrg.id })
      .eq("owner_user_id", user.id)
      .is("organization_id", null);

    // Create user_venue_roles entries
    const { data: userVenues } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("owner_user_id", user.id);

    if (userVenues && userVenues.length > 0) {
      const venueRoles = userVenues.map(venue => ({
        user_id: user.id,
        venue_id: venue.venue_id,
        organization_id: newOrg.id,
        role: "owner",
        permissions: { all: true }
      }));

      await supabase
        .from("user_venue_roles")
        .upsert(venueRoles, {
          onConflict: "user_id,venue_id"
        });
    }

    console.log("[ORG ENSURE] Created new organization:", newOrg.id, "for user:", user.id);

    const response = NextResponse.json({
      success: true,
      organization: newOrg,
      created: true
    });
    
    // Add cache control headers to ensure fresh data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error: any) {
    console.error("[ORG ENSURE] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

