import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";
import { success, apiErrors } from "@/lib/api/standard-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Save menu items to Supabase using service role key
    if (body.items && Array.isArray(body.items) && body.venue_id) {
      const supabase = await createClient();
      // Attach venue_id to each item if not present
      const itemsToInsert = body.items.map((item: Record<string, unknown>) => ({
        ...item,

        is_available: (item.available as boolean | undefined) !== false, // default to true
      }));
      const { error } = await supabase.from("menu_items").insert(itemsToInsert);
      if (error) {
        return apiErrors.badRequest(error.message);
      }
      return success({ success: true });
    }

    return apiErrors.badRequest("Missing items or venue_id");
  } catch (_err) {
    return apiErrors.internal(_err instanceof Error ? _err.message : "Failed to save menu.");
  }
}
