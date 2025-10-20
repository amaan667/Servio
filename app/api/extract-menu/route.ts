import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Save menu items to Supabase using service role key
    if (body.items && Array.isArray(body.items) && body.venue_id) {
          const supabase = await createClient();
      // Attach venue_id to each item if not present
      const itemsToInsert = body.items.map((item: any) => ({
        ...item,
        venue_id: body.venue_id,
        is_available: item.available !== false, // default to true
      }));
              const { error } = await supabase.from("menu_items").insert(itemsToInsert);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Missing items or venue_id" },
      { status: 400 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save menu." },
      { status: 500 },
    );
  }
}
