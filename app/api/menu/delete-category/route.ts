import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

export async function POST(_request: NextRequest) {
  try {
    const { venueId, categoryName } = await _request.json();

    if (!venueId || !categoryName) {
      return NextResponse.json(
        {

        },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    // First, check if this category has menu items
    const { data: menuItems, error: menuItemsError } = await supabase
      .from("menu_items")
      .select("id, name")
      .eq("venue_id", venueId)
      .eq("category", categoryName);

    if (menuItemsError) {
      
      return NextResponse.json(
        {

          error: `Failed to fetch menu items: ${menuItemsError.message}`,
        },
        { status: 500 }
      );
    }

    const itemsToDelete = menuItems || [];

    // Delete all menu items in this category
    if (itemsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueId)
        .eq("category", categoryName);

      if (deleteError) {
        
        return NextResponse.json(
          {

            error: `Failed to delete menu items: ${deleteError.message}`,
          },
          { status: 500 }
        );
      }
    }

    // Also delete related data (images, aliases, options, etc.)
    const relatedTables = ["item_images", "item_aliases", "option_choices", "options"];

    for (const table of relatedTables) {
      try {
        // For tables that reference menu_items, we need to delete by menu item IDs
        if (table === "item_images" || table === "item_aliases" || table === "option_choices") {
          if (itemsToDelete.length > 0) {
            const itemIds = itemsToDelete.map((item) => item.id);
            const { error } = await supabase.from(table).delete().in("menu_item_id", itemIds);

            if (error) {
              
            }
          }
        } else if (table === "options") {
          // Options table might have venue_id, delete by category
          const { error } = await supabase
            .from(table)
            .delete()
            .eq("venue_id", venueId)
            .eq("category", categoryName);

          if (error) {
            
          }
        }
      } catch (_error) {
        
      }
    }

    return NextResponse.json({

      message: `Category "${categoryName}" and its items deleted successfully`,

  } catch (_error) {
    
    return NextResponse.json(
      {

      },
      { status: 500 }
    );
  }
}
