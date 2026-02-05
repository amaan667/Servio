import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { apiErrors } from "@/lib/api/standard-response";

/**
 * GET: List corrections for a venue (optional venueId query).
 * POST: Submit a correction for a menu item (low-confidence field override).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get("venueId");
  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_item_corrections")
    .select("id, venue_id, menu_item_id, item_name, field, value_text, value_number, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ corrections: data ?? [] });
}

const ALLOWED_FIELDS = ["name", "description", "price", "category", "image_url"];

export const POST = createUnifiedHandler(
  async (_req, context) => {
    const venueId = context.venueId;
    const body = context.body as {
      menu_item_id?: string;
      item_name?: string;
      field?: string;
      value_text?: string;
      value_number?: number;
    };
    const { menu_item_id, item_name, field, value_text, value_number } = body;

    if (!field || !ALLOWED_FIELDS.includes(field)) {
      return apiErrors.badRequest("field must be one of: " + ALLOWED_FIELDS.join(", "));
    }
    if (!menu_item_id) {
      return apiErrors.badRequest("menu_item_id required");
    }

    const isNumber = field === "price";
    if (isNumber && value_number == null) {
      return apiErrors.badRequest("value_number required for price");
    }
    if (!isNumber && value_text == null) {
      return apiErrors.badRequest("value_text required for non-price fields");
    }

    const supabase = await createClient();
    const row = {
      venue_id: venueId,
      menu_item_id: menu_item_id || null,
      item_name: item_name?.trim() || null,
      field,
      value_text: isNumber ? null : (value_text ?? null),
      value_number: isNumber ? value_number : null,
      user_id: context.user?.id ?? null,
    };

    const { data, error } = await supabase
      .from("menu_item_corrections")
      .upsert(row, {
        onConflict: "venue_id,menu_item_id,field",
        ignoreDuplicates: false,
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return { ok: true, correction: data };
  },
  {
    requireVenueAccess: true,
    venueIdSource: "auto",
  }
);