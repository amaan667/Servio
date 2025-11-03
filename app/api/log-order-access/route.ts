import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({
      /* Empty */
    }));

    const ipFromHeaders =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip");
    const logData = {
      tag: "[ORDER ACCESS]".padEnd(16),
      timestamp: new Date().toISOString(),
      ip: ipFromHeaders || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
      url: data?.url || req.nextUrl?.toString(),
      venueSlug: data?.venueSlug,
      tableNumber: data?.tableNumber,
      counterNumber: data?.counterNumber,
      orderType: data?.orderType,
      orderLocation: data?.orderLocation,
      isDemo: data?.isDemo,
    };


    return NextResponse.json({ ok: true });
  } catch (_err) {
    logger.error("[ORDER ACCESS] log failure:", { value: _err });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
