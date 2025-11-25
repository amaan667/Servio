import { NextResponse } from "next/server";

// Ultra-minimal health check for Railway - instant response, zero overhead
// MUST respond immediately for Railway initialization
export const runtime = "edge";
export const dynamic = "force-dynamic";

// Edge runtime = fastest possible response, no Node.js overhead
export async function GET() {
  // Return plain text "ok" - fastest possible response
  return new NextResponse("ok", { 
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "no-store",
    },
  });
}
