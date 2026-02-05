import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";

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

export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  const venueId = context.venueId;
  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  const body = await req.json();
  const { menu_item_id, item_name, field, value_text, value_number } = body as {
    menu_item_id?: string;
    item_name?: string;
    field?: string;
    value_text?: string;
    value_number?: number;
  };

  const allowedFields = ["name", "description", "price", "category", "image_url"];
  if (!field || !allowedFields.includes(field)) {
    return NextResponse.json({ error: "field must be one of: " + allowedFields.join(", ") }, { status: 400 });
  }
  if (!menu_item_id) {
    return NextResponse.json({ error: "menu_item_id required" }, { status: 400 });
  }

  const isNumber = field === "price";
  if (isNumber && value_number == null) {
    return NextResponse.json({ error: "value_number required for price" }, { status: 400 });
  }
  if (!isNumber && value_text == null) {
    return NextResponse.json({ error: "value_text required for non-price fields" }, { status: 400 });
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
  return NextResponse.json({ ok: true, correction: data });
});