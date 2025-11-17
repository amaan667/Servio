import { NextRequest, NextResponse } from "next/server";

// Switch to nodejs runtime - edge runtime causes socket errors on Railway
export const runtime = "nodejs";

// Make this endpoint super fast and non-blocking
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    // Parse the vitals data (consumed but not used - analytics endpoint)
    await req.json();

    // In production, you could send to analytics service
    // For now, just return success immediately - don't block
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    // Even if it fails, return 200 so the client doesn't retry
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
