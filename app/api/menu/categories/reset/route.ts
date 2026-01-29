import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(_request: NextRequest) {
  try {
    const { venueId } = await _request.json();

    if (!venueId) {
      return NextResponse.json(
        {
          ok: false,
          error: "venueId is required",
        },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    // Get the most recent menu upload to get the original category order
    const { data: uploadData, error: uploadError } = await supabase
      .from("menu_uploads")
      .select("category_order")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (uploadError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to fetch original categories: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    if (!uploadData?.category_order || !Array.isArray(uploadData.category_order)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No original categories found from PDF upload",
        },
        { status: 404 }
      );
    }

    const originalCategories = uploadData.category_order;

    // Get all current menu items
    const { data: menuItems, error: menuItemsError } = await supabase
      .from("menu_items")
      .select("id, category")
      .eq("venue_id", venueId);

    if (menuItemsError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to fetch menu items: ${menuItemsError.message}`,
        },
        { status: 500 }
      );
    }

    // Get all current categories from menu items
    const currentCategories = [...new Set(menuItems?.map((item) => item.category) || [])];

    // Find categories that were added manually (not in original PDF)
    const manuallyAddedCategories = currentCategories.filter(
      (cat) => !originalCategories.some((origCat) => origCat.toLowerCase() === cat.toLowerCase())
    );

    // Create a mapping of original categories to current categories
    // This preserves translations while maintaining original order
    const categoryMapping: Record<string, string> = {
      /* Empty */
    };
    originalCategories.forEach((origCat) => {
      const matchingCurrentCat = currentCategories.find(
        (currCat) => currCat.toLowerCase() === origCat.toLowerCase()
      );
      if (matchingCurrentCat) {
        categoryMapping[origCat] = matchingCurrentCat;
      }
    });

    // Delete menu items that belong to manually added categories
    if (manuallyAddedCategories.length > 0) {
      const { error: deleteError } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueId)
        .in("category", manuallyAddedCategories);

      if (deleteError) {
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to delete items from manual categories: ${deleteError.message}`,
          },
          { status: 500 }
        );
      }
    }

    // Create the new category order preserving translations but maintaining original order
    const resetCategoryOrder = originalCategories.map(
      (origCat) => categoryMapping[origCat] || origCat
    );

    // Update the category_order in the most recent upload to reflect the reset
    const { error: updateError } = await supabase
      .from("menu_uploads")
      .update({
        category_order: resetCategoryOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (updateError) {
      // Don't fail the entire operation for this
    }

    return NextResponse.json({
      ok: true,
      message: "Categories reset to original PDF order successfully (translations preserved)",
      originalCategories: resetCategoryOrder,
      removedCategories: manuallyAddedCategories,
      removedItemsCount:
        menuItems?.filter((item) => manuallyAddedCategories.includes(item.category)).length || 0,
    });
  } catch (_error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
