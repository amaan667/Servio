import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Log web vitals for monitoring
    logger.info("[WEB_VITALS]", {
      metric: data.name,
      value: data.value,
      rating: data.rating,
      url: data.url,
    });

    // In production, you might send this to a monitoring service like:
    // - Vercel Analytics
    // - Google Analytics
    // - Sentry
    // - Custom analytics endpoint

    return NextResponse.json({ success: true });
  } catch {
    // Silent error handling for vitals - non-critical
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
