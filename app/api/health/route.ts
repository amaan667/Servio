import { NextResponse } from "next/server";

// Ultra-minimal health check for Railway - instant response
// MUST work even before build completes
// Deployment force: 2025-11-26 14:20:00 UTC
export async function GET() {
  // Return plain text "ok" - fastest possible response
  // No edge runtime (needs build first), no dependencies
  return new NextResponse("ok", { 
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
