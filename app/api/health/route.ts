import { NextResponse } from "next/server";

// Ultra-minimal liveness check for Railway / load balancer - instant response.
// For readiness (DB, Redis, Stripe) use GET /api/ready instead. See INCIDENT.md.
export async function GET() {
  // Return plain text "ok" - fastest possible response; no dependencies
  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "X-Deploy-Time": new Date().toISOString(),
    },
  });
}
