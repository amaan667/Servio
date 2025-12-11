import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api/validation-schemas";
import { z } from "zod";

const logSchema = z.object({
  venueSlug: z.string().trim().max(80).optional(),
  tableNumber: z.union([z.string(), z.number()]).optional(),
  counterNumber: z.union([z.string(), z.number()]).optional(),
  orderType: z.string().trim().max(40).optional(),
  isDemo: z.boolean().optional(),
  url: z.string().trim().max(500).optional(),
  userAgent: z.string().trim().max(500).optional(),
  timestamp: z.string().trim().max(64).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rateResult = await rateLimit(req, RATE_LIMITS.STRICT);
    if (!rateResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests",
          retryAfter: Math.ceil((rateResult.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    const body = await validateBody(logSchema, await req.json());

    // Log QR scan to server logs (will appear in Railway)
    logger.info("QR code scanned", {
      venueSlug: body.venueSlug,
      tableNumber: body.tableNumber,
      counterNumber: body.counterNumber,
      orderType: body.orderType,
      isDemo: body.isDemo,
      url: body.url,
      userAgent: body.userAgent?.substring(0, 200),
      timestamp: new Date().toISOString(),
      clientTimestamp: body.timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (_error) {
    logger.error("Failed to log QR scan", {
      error: _error instanceof Error ? _error.message : String(_error),
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
