import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side logging endpoint for payment flow
 * Client can call this to log events that will appear in Railway logs
 * Uses console.log/console.error directly so Railway captures the logs
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { level = "info", event, data, details, timestamp } = body;

    // Handle both 'data' and 'details' fields for backward compatibility
    const logDetails = data || details || {};
    
    const logMessage = `[PAYMENT FLOW] ${event}`;
    const logData = {
      event,
      timestamp: timestamp || new Date().toISOString(),
      ...logDetails,
    };

    // Use console.log/console.error directly so Railway captures it
    // Railway logs capture stdout/stderr
    const logString = `[${logData.timestamp}] ${logMessage} ${JSON.stringify(logData, null, 2)}`;
    
    if (level === "error") {
      console.error(logString);
    } else if (level === "warn") {
      console.warn(logString);
    } else {
      console.log(logString);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Don't fail if logging fails, but log the error
    console.error("[PAYMENT FLOW LOG] Failed to log:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false });
  }
}
