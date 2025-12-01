import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * API endpoint to log payment flow events from client to server
 * This ensures payment flow logs appear in Railway logs
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({}));

    // Extract log data
    const { level = "info", event, details } = data;

    // Log to server using logger (appears in Railway logs)
    const logMessage = `[PAYMENT FLOW] ${event}`;
    
    if (level === "error") {
      logger.error(logMessage, details || {});
    } else if (level === "warn") {
      logger.warn(logMessage, details || {});
    } else {
      logger.info(logMessage, details || {});
    }

    return NextResponse.json({ ok: true });
  } catch (_err) {
    // Don't fail the request if logging fails
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

