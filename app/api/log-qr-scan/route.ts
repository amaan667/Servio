import { NextRequest, NextResponse } from "next/server";

import { getClientIdentifier, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
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
    const rateResult = await rateLimit(req, {
      ...RATE_LIMITS.MENU_PUBLIC,
      identifier: `log-qr-scan:${getClientIdentifier(req)}`,
    });
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

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
