import { NextResponse } from "next/server";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { getAccessContext } from "@/lib/access/getAccessContext";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    console.log("[AUTH DEBUG] Debug endpoint called");

    // Use the same authentication method as other API routes
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      console.log("[AUTH DEBUG] Auth failed:", { error: authError, hasUser: !!user });
      return NextResponse.json({
        error: "Not authenticated",
        details: authError
      }, { status: 401 });
    }

    console.log("[AUTH DEBUG] Auth successful, user:", { id: user.id, email: user.email });

    // Get venueId from query params
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");
    const checkDatabase = searchParams.get("checkDatabase") === "true";

    console.log("[AUTH DEBUG] Testing access context with venueId:", venueId);

    // Test access context
    const accessContext = await getAccessContext(venueId);

    console.log("[AUTH DEBUG] Access context result:", accessContext);

    let databaseInfo = null;

    if (checkDatabase) {
      console.log("[AUTH DEBUG] Running database checks...");

      const supabase = await createServerSupabase();

      // Check organizations
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_user_id', user.id);

      // Check venues owned by user
      const { data: userVenues, error: userVenuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('owner_user_id', user.id);

      // Check specific venue if provided
      let venueCheck = null;
      if (venueId) {
        const { data: venue, error: venueError } = await supabase
          .from('venues')
          .select('*')
          .eq('venue_id', venueId)
          .single();

        venueCheck = { venue, error: venueError };
      }

      // Check staff roles
      const { data: staffRoles, error: staffError } = await supabase
        .from('user_venue_roles')
        .select('*')
        .eq('user_id', user.id);

      databaseInfo = {
        organizations: { data: orgs, error: orgError },
        userVenues: { data: userVenues, error: userVenuesError },
        venueCheck,
        staffRoles: { data: staffRoles, error: staffError }
      };

      console.log("[AUTH DEBUG] Database check results:", databaseInfo);
    }

    // Return comprehensive debug info
    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      message: "Authentication working correctly",
      debug: {
        venueId,
        accessContext,
        tier: accessContext?.tier,
        role: accessContext?.role,
        userId: accessContext?.user_id,
        venueIds: accessContext?.venue_ids
      },
      ...(checkDatabase && { database: databaseInfo })
    });
  } catch (error) {
    console.log("[AUTH DEBUG] Debug endpoint error:", error);
    return NextResponse.json({
      error: "Server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
