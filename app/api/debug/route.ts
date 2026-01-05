import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check user's organizations
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_user_id", user.id);

    // Check user's venues
    const { data: venues, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("owner_user_id", user.id);

    // Check user_venue_roles
    const { data: roles, error: roleError } = await supabase
      .from("user_venue_roles")
      .select("*")
      .eq("user_id", user.id);

    // Test RPC
    const { data: rpcResult, error: rpcError } = await supabase.rpc("get_access_context", {
      p_venue_id: "venue-1e02af4d"
    });

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      organizations,
      venues,
      roles,
      rpcResult,
      errors: {
        orgError: orgError?.message,
        venueError: venueError?.message,
        roleError: roleError?.message,
        rpcError: rpcError?.message,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
