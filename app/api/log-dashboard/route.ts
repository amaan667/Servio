import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const dashboardLogSchema = z.object({
  level: z.enum(["info", "warn", "error"]).default("info"),

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = dashboardLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {

        },
        { status: 400 }
      );
    }

    const { level, event, venueId, timestamp, details } = parsed.data;

    const logPayload = {

      event,

      details: details ?? {},
    };

    const message = `[DASHBOARD] ${event}`;

    // Use console.* so Railway always captures these logs from server runtime
    if (level === "error") {
          } else if (level === "warn") {
          } else {
          }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ ok: false }, { status: 500 });
  }
}
