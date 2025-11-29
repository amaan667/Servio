import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Test all logging methods
  console.info("[RAILWAY TEST] console.info - This should appear");
  console.log("[RAILWAY TEST] console.log - This should appear");
  console.error("[RAILWAY TEST] console.error - This should appear");
  console.warn("[RAILWAY TEST] console.warn - This should appear");
  
  if (typeof process !== 'undefined' && process.stdout) {
    process.stdout.write("[RAILWAY TEST] process.stdout.write - This should appear\n");
  }
  
  if (typeof process !== 'undefined' && process.stderr) {
    process.stderr.write("[RAILWAY TEST] process.stderr.write - This should appear\n");
  }
  
  return NextResponse.json({ 
    message: "Check Railway logs for test messages",
    timestamp: new Date().toISOString()
  });
}

