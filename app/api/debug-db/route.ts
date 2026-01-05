import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    console.log("[DEBUG DB] Checking database contents...");

    const supabase = await createServerSupabase();

    // Check all organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*');

    console.log("[DEBUG DB] Organizations:", { count: orgs?.length, data: orgs, error: orgError });

    // Check all venues
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('*');

    console.log("[DEBUG DB] Venues:", { count: venues?.length, data: venues, error: venueError });

    // Check specific venue mentioned in logs
    const { data: specificVenue, error: specificVenueError } = await supabase
      .from('venues')
      .select('*')
      .eq('venue_id', 'venue-1e02af4d');

    console.log("[DEBUG DB] Specific venue venue-1e02af4d:", { data: specificVenue, error: specificVenueError });

    // Check user_venue_roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_venue_roles')
      .select('*');

    console.log("[DEBUG DB] User venue roles:", { count: roles?.length, data: roles, error: rolesError });

    return NextResponse.json({
      success: true,
      database: {
        organizations: { count: orgs?.length, data: orgs, error: orgError?.message },
        venues: { count: venues?.length, data: venues, error: venueError?.message },
        specificVenue: { data: specificVenue, error: specificVenueError?.message },
        userVenueRoles: { count: roles?.length, data: roles, error: rolesError?.message }
      }
    });

  } catch (error) {
    console.error("[DEBUG DB] Error:", error);
    return NextResponse.json({
      error: "Database debug error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
