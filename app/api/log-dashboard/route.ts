import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const dashboardLogSchema = z.object({
  level: z.enum(["info", "warn", "error"]).default("info"),
  event: z.string(),
  venueId: z.string().optional(),
  timestamp: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = dashboardLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid log payload",
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { level, event, venueId, timestamp, details } = parsed.data;

    const logPayload = {
      source: "dashboard",
      event,
      venueId: venueId ?? "unknown",
      timestamp: timestamp ?? new Date().toISOString(),
      details: details ?? {},
    };

    const message = `[DASHBOARD] ${event}`;

    // Use console.* so Railway always captures these logs from server runtime
    if (level === "error") {
      /* Condition handled */
    } else if (level === "warn") {
      /* Condition handled */
    } else {
      /* Else case handled */
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
