import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { userId, venueId } = await req.json();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { success: false, message: "Missing Supabase config" },
      { status: 500 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Delete venue and related data
    if (venueId) {
      await admin.from("venues").delete().eq("venue_id", venueId);
      // Optionally: delete related menu_items, orders, etc.
    }
    // Delete user from Auth
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
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
