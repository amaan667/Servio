import { NextResponse } from "next/server";

// Ultra-minimal health check for Railway - instant response
// MUST work even before build completes
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
