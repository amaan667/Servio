// API endpoint to ensure a user has a real organization
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Disable caching to always get fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("[ORG ENSURE] Auth error:", userError);
      return NextResponse.json(
        { error: "Unauthorized", details: userError?.message },
        { status: 401 }
      );
    }

    console.log("[ORG ENSURE] User authenticated:", user.id);

    // Use admin client to bypass RLS for organization operations
    let adminClient;
    try {
      adminClient = createAdminClient();
      console.log("[ORG ENSURE] Admin client created successfully");
    } catch (adminError) {
      console.error("[ORG ENSURE] Failed to create admin client:", adminError);
      return NextResponse.json(
        { error: "Admin client creation failed", details: String(adminError) },
        { status: 500 }
      );
    }
    
    // Verify SERVICE_ROLE_KEY is set
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[ORG ENSURE] SUPABASE_SERVICE_ROLE_KEY is not set!");
      return NextResponse.json(
        { error: "Server configuration error: Missing SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    // Check if user already has an organization
    console.log("[ORG ENSURE] Checking for existing organization for user:", user.id);
    const { data: existingOrg, error: orgCheckError } = await adminClient
      .from("organizations")
      .select("id, subscription_tier, subscription_status, is_grandfathered, trial_ends_at")
      .eq("created_by", user.id)
      .maybeSingle();

    if (orgCheckError) {
      console.error("[ORG ENSURE] Error checking existing org:", orgCheckError);
    }

    // If organization exists, return it with no-cache headers
    if (existingOrg && !orgCheckError) {
      console.log("[ORG ENSURE] Found existing organization:", existingOrg.id);
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

    console.log("[ORG ENSURE] No existing organization, creating new one");

    // Get user's name for organization name
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    
    // Create organization for the user using admin client to bypass RLS
    const { data: newOrg, error: createError } = await adminClient
      .from("organizations")
      .insert({
        name: `${userName}'s Organization`,
        slug: `org-${user.id.slice(0, 8)}-${Date.now()}`,
        created_by: user.id,
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
      console.error("[ORG ENSURE] Error details:", JSON.stringify(createError, null, 2));
      console.error("[ORG ENSURE] User ID:", user.id);
      console.error("[ORG ENSURE] User metadata:", user.user_metadata);
      return NextResponse.json(
        { 
          error: "Failed to create organization", 
          details: createError.message,
          code: createError.code,
          hint: createError.hint
        },
        { status: 500 }
      );
    }

    // Update any venues to link to this organization (using admin client)
    await adminClient
      .from("venues")
      .update({ organization_id: newOrg.id })
      .eq("owner_user_id", user.id)
      .is("organization_id", null);

    // Create user_venue_roles entries (using admin client)
    const { data: userVenues } = await adminClient
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

      await adminClient
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

