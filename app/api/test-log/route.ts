import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Test all logging methods
        
  if (typeof process !== "undefined" && process.stdout) {
    process.stdout.write("[RAILWAY TEST] process.stdout.write - This should appear\n");
  }

  if (typeof process !== "undefined" && process.stderr) {
    process.stderr.write("[RAILWAY TEST] process.stderr.write - This should appear\n");
  }

  return NextResponse.json({

}
