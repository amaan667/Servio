import { NextResponse } from "next/server";

export const runtime = "nodejs";

type SessionParams = { params?: { sessionId?: string } };

export async function GET(_req: Request, context: SessionParams = {}) {
  try {
    const sessionId = context.params?.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: "Session ID is required",
        },
        { status: 400 }
      );
    }

    // Since session_id column doesn't exist in database yet, we'll use localStorage approach
    // For now, return null to indicate no session-based order found
    // This will be handled client-side using localStorage

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
