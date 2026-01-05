import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";

export async function GET() {
  try {
    const supabase = await createServerSupabase();

    // First try to get user directly from supabase
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({
        error: "Not authenticated",
        userError: userError?.message,
        hasUser: !!user,
        userId: user?.id
      }, { status: 401 });
    }

    // Test RPC directly
    const { data: rpcResult, error: rpcError } = await supabase.rpc("get_access_context", {
      p_venue_id: "venue-1e02af4d"
    });

    // Check user's organizations
    const { data: organizations, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_user_id", user.id);

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      rpcResult,
      organizations,
      errors: {
        rpcError: rpcError?.message,
        orgError: orgError?.message,
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
