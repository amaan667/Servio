import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return apiErrors.notFound("Not found");
  }

  const internalSecret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET;
  if (!internalSecret) {
    return apiErrors.internal("INTERNAL_API_SECRET (or CRON_SECRET) is not configured");
  }

  if (req.headers.get("authorization") !== `Bearer ${internalSecret}`) {
    return apiErrors.unauthorized("Unauthorized");
  }

  // Test all logging methods

  if (typeof process !== "undefined" && process.stdout) {
    process.stdout.write("[RAILWAY TEST] process.stdout.write - This should appear\n");
  }

  if (typeof process !== "undefined" && process.stderr) {
    process.stderr.write("[RAILWAY TEST] process.stderr.write - This should appear\n");
  }

  return NextResponse.json({
    message: "Check Railway logs for test messages",
    timestamp: new Date().toISOString(),
  });
}
