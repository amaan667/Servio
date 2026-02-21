import { NextRequest } from "next/server";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase";
import { success, apiErrors } from "@/lib/api/standard-response";
import { z } from "zod";

export const runtime = "nodejs";

const postSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["table", "counter", "table_pickup"]),
});

export const GET = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const venueId = context.venueId;
    if (!venueId) return apiErrors.badRequest("venueId is required");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("venue_qr_hidden")
      .select("qr_key")
      .eq("venue_id", venueId);

    if (error) return apiErrors.database("Failed to fetch hidden QR keys");

    const hiddenKeys = (data ?? []).map((r) => r.qr_key);
    return success({ hiddenKeys });
  },
  { requireVenueAccess: true, rateLimit: RATE_LIMITS.GENERAL }
);

export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const venueId = context.venueId;
    if (!venueId) return apiErrors.badRequest("venueId is required");

    const { body } = context;
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) return apiErrors.validation(parsed.error.message, parsed.error.flatten());

    const qrKey = `${parsed.data.name}|${parsed.data.type}`;
    const supabase = await createClient();

    const { error } = await supabase.from("venue_qr_hidden").insert({
      venue_id: venueId,
      qr_key: qrKey,
    });

    if (error) {
      if (error.code === "23505") return success({ hiddenKey: qrKey });
      return apiErrors.database("Failed to hide QR code");
    }

    return success({ hiddenKey: qrKey });
  },
  { schema: postSchema, requireVenueAccess: true, rateLimit: RATE_LIMITS.GENERAL }
);
