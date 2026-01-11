import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api/validation-schemas";
import { z } from "zod";

const logSchema = z.object({

  tableNumber: z.union([z.string(), z.number()]).optional(),
  counterNumber: z.union([z.string(), z.number()]).optional(),

export async function POST(req: NextRequest) {
  try {
    const rateResult = await rateLimit(req, RATE_LIMITS.STRICT);
    if (!rateResult.success) {
      return NextResponse.json(
        {

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
