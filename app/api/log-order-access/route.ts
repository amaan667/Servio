import { NextRequest, NextResponse } from "next/server";

import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api/validation-schemas";
import { z } from "zod";

const logSchema = z.object({
  url: z.string().trim().max(500).optional(),
  venueSlug: z.string().trim().max(80).optional(),
  tableNumber: z.union([z.string(), z.number()]).optional(),
  counterNumber: z.union([z.string(), z.number()]).optional(),
  orderType: z.string().trim().max(40).optional(),
  orderLocation: z.string().trim().max(80).optional(),
  isDemo: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rateResult = await rateLimit(req, RATE_LIMITS.STRICT);
    if (!rateResult.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests",
          retryAfter: Math.ceil((rateResult.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    const data = await validateBody(logSchema, await req.json().catch(() => ({})));

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

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
