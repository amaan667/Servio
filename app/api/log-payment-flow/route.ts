import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side logging endpoint for payment flow
 * Client can call this to log events
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

      ...logDetails,
    };

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false });
  }
}
