import { NextResponse } from "next/server";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { getAccessContext } from "@/lib/access/getAccessContext";

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

    console.log("[AUTH DEBUG] Testing access context with venueId:", venueId);

    // Test access context
    const accessContext = await getAccessContext(venueId);

    console.log("[AUTH DEBUG] Access context result:", accessContext);

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
      }
    });
  } catch (error) {
    console.log("[AUTH DEBUG] Debug endpoint error:", error);
    return NextResponse.json({
      error: "Server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
