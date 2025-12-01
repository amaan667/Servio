import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Server-side logging endpoint for payment flow
 * Client can call this to log events that will appear in Railway logs
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { level = "info", event, data, timestamp } = body;

    const logMessage = `[PAYMENT FLOW] ${event}`;
    const logData = {
      event,
      timestamp: timestamp || new Date().toISOString(),
      ...data,
    };

    if (level === "error") {
      logger.error(logMessage, logData);
    } else if (level === "warn") {
      logger.warn(logMessage, logData);
    } else {
      logger.info(logMessage, logData);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Don't fail if logging fails
    return NextResponse.json({ ok: false });
  }
}
