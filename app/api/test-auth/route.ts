import { NextResponse } from "next/server";
import { getAuthUserForAPI } from "@/lib/auth/server";
import { getAccessContext } from "@/lib/access/getAccessContext";

export async function GET() {
  try {
    const results = {
      timestamp: new Date().toISOString(),
      auth: null as any,
      accessContext: null as any,
      errors: [] as string[],
    };

    // Test 1: API route authentication
    try {
      const { user, error: authError } = await getAuthUserForAPI();
      results.auth = {
        success: !authError && !!user,
        userId: user?.id,
        email: user?.email,
        error: authError,
      };
    } catch (error) {
      results.errors.push(`Auth test failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 2: Access context for venue-1e02af4d
    try {
      const context = await getAccessContext("venue-1e02af4d");
      results.accessContext = {
        success: !!context,
        userId: context?.user_id,
        venueId: context?.venue_id,
        role: context?.role,
        tier: context?.tier,
        venueIdsCount: context?.venue_ids?.length || 0,
      };
    } catch (error) {
      results.errors.push(`Access context test failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({
      error: "Test failed",
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
