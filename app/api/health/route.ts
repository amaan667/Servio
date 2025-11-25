import { NextResponse } from "next/server";

// Ultra-simple health check for Railway - no dependencies, no blocking operations
// This must respond quickly (< 1 second) for Railway to detect the app is ready
export async function GET() {
  // Return immediately without any async operations that could block
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
