import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { userId, venueId } = await req.json();
  const supabase = await createClient();

  try {
    // Delete venue and related data
    if (venueId) {
      await supabase.from("venues").delete().eq("venue_id", venueId);
      // Optionally: delete related menu_items, orders, etc.
    }
    // Delete user from Auth
    if (userId) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        message: _error instanceof Error ? _error.message : "Failed to delete account",
      },
      { status: 500 }
    );
  }
}
