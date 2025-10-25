import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

/**
 * Debug endpoint to see recently added menu items
 * Shows what was extracted from URL scraping
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get("venueId");
    const limit = parseInt(searchParams.get("limit") || "10");

    if (!venueId) {
      return NextResponse.json({ error: "venueId required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get most recent menu items
    const { data: items, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Format nicely
    const formatted = items?.map((item, index) => ({
      position: index + 1,
      name: item.name,
      price: item.price,
      category: item.category,
      description: item.description?.substring(0, 100) || "N/A",
      hasImage: !!item.image_url,
      imageUrl: item.image_url,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));

    return NextResponse.json({
      venueId,
      totalItems: items?.length || 0,
      items: formatted,
      message: `Showing ${items?.length || 0} most recent menu items`,
    });
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch items" },
      { status: 500 }
    );
  }
}
