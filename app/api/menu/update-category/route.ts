import { NextRequest, NextResponse } from "next/server";
// Deployment trigger
import { createClient } from "@/lib/supabase";

import { apiErrors } from "@/lib/api/standard-response";

export async function POST(_request: NextRequest) {
  try {
    const { venueId, oldCategory, newCategory } = await _request.json();

    if (!venueId || !oldCategory || !newCategory) {
      return NextResponse.json(
        { error: "venueId, oldCategory, and newCategory are required" },
        { status: 400 }
      );
    }

    if (oldCategory === newCategory) {
      return NextResponse.json({
        success: true,
        message: "No changes needed",
      });
    }

    const supabase = await createClient();

    // Update all menu items with the old category name
    const { data: updatedItems, error: updateError } = await supabase
      .from("menu_items")
      .update({ category: newCategory })
      .eq("venue_id", venueId)
      .eq("category", oldCategory)
      .select("id, name, category");

    if (updateError) {

      return apiErrors.internal("Failed to update menu items");
    }

    // Update category order in menu_uploads if it exists
    const { data: uploadData, error: fetchError } = await supabase
      .from("menu_uploads")
      .select("id, category_order")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!fetchError && uploadData?.category_order) {
      const updatedCategoryOrder = uploadData.category_order.map((cat: string) =>
        cat === oldCategory ? newCategory : cat
      );

      const { error: orderUpdateError } = await supabase
        .from("menu_uploads")
        .update({
          category_order: updatedCategoryOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", uploadData.id);

      if (orderUpdateError) {

        // Don't fail the whole operation for this
      }
    }

    return NextResponse.json({
      success: true,
      message: `Category updated from "${oldCategory}" to "${newCategory}"`,
      updatedItems: updatedItems?.length || 0,
    });
  } catch (_error) {

    return apiErrors.internal("Internal server error");
  }
}
