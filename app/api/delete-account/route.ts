import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId, venueId } = await req.json();
  const supabase = createClient();

  try {
    // Delete venue and related data
    if (venueId) {
      await createClient().from("venues").delete().eq("venue_id", venueId);
      // Optionally: delete related menu_items, orders, etc.
    }
    // Delete user from Auth
    if (userId) {
      const { error } = await createClient().auth.admin.deleteUser(userId);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete account" },
      { status: 500 },
    );
  }
}
