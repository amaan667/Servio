import { NextResponse } from "next/server";
import { getAuthUserForAPI } from "@/lib/auth/server";

export async function GET() {
  try {
    // Use the same authentication method as other API routes
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({
        error: "Not authenticated",
        details: authError
      }, { status: 401 });
    }

    // Return success - authentication is working
    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      message: "Authentication working correctly"
    });
  } catch (error) {
    return NextResponse.json({
      error: "Server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
