// Servio AI Assistant - Menu Tools
// Handles menu-related operations

import { createClient } from "@/lib/supabase";
import {
  MenuUpdatePricesParams,
  MenuToggleAvailabilityParams,
  MenuCreateItemParams,
  MenuDeleteItemParams,
  AIPreviewDiff,
  AIExecutionResult,
  AIAssistantError,
  DEFAULT_GUARDRAILS,
} from "@/types/ai-assistant";

export async function executeMenuUpdatePrices(

    throw new AIAssistantError("No items specified for price update", "INVALID_PARAMS");
  }

  // Validate guardrails - fetch current items
  const { data: currentItems, error: fetchError } = await supabase
    .from("menu_items")
    .select("id, name, price, category")
    .eq("venue_id", venueId)
    .in(
      "id",
      params.items.map((i) => i.id)
    );

  if (fetchError) {
    
    throw new AIAssistantError("Failed to fetch menu items", "EXECUTION_FAILED", {

  }

  if (!currentItems || currentItems.length === 0) {
    throw new AIAssistantError("No items found matching the provided IDs", "INVALID_PARAMS");
  }

  

  // Validate all item IDs exist
  const foundIds = new Set(currentItems.map((i) => i.id));
  const missingIds = params.items.filter((i) => !foundIds.has(i.id));
  if (missingIds.length > 0) {
     => i.id)
    );
    throw new AIAssistantError(
      `Some items not found: ${missingIds.length} items do not exist`,
      "INVALID_PARAMS",
      { missingIds: missingIds.map((i) => i.id) }
    );
  }

  // Check price change guardrail (±20%)
  const maxChangePercent = DEFAULT_GUARDRAILS["menu.update_prices"].maxPriceChangePercent || 20;

  for (const item of params.items) {
    const current = currentItems.find((i) => i.id === item.id);
    if (!current) continue;

    // Validate new price is positive
    if (item.newPrice <= 0) {
      throw new AIAssistantError(
        `Invalid price for ${current.name}: price must be greater than 0`,
        "INVALID_PARAMS",
        { itemId: item.id, itemName: current.name, newPrice: item.newPrice }
      );
    }

    const changePercent = Math.abs(((item.newPrice - current.price) / current.price) * 100);
    }% change)`
    );

    if (changePercent > maxChangePercent) {
      throw new AIAssistantError(
        `Price change of ${changePercent.toFixed(1)}% for "${current.name}" exceeds limit of ${maxChangePercent}%`,
        "GUARDRAIL_VIOLATION",
        {

        }
      );
    }
  }

  // Preview mode
  if (preview) {
    const before = currentItems.map((i) => ({ id: i.id, name: i.name, price: i.price }));
    const after = currentItems.map((i) => {
      const update = params.items.find((u) => u.id === i.id);
      return {

      };

    const oldRevenue = before.reduce((sum, i) => sum + i.price, 0);
    const newRevenue = after.reduce((sum, i) => sum + i.price, 0);

    return {

      before,
      after,

        description: `${params.items.length} items will be updated. Estimated revenue impact: ${(((newRevenue - oldRevenue) / oldRevenue) * 100).toFixed(1)}%`,
      },
    };
  }

  // Execute - update prices for each item
  
  let updatedCount = 0;
  const failedUpdates: Array<{ id: string; name: string; error: string }> = [];

  for (const item of params.items) {
    const currentItem = currentItems.find((i) => i.id === item.id);
    const itemName = currentItem?.name || item.id;

    const { data, error } = await supabase
      .from("menu_items")
      .update({

      .eq("id", item.id)
      .eq("venue_id", venueId)
      .select("id, name, price");

    if (error) {
      
      failedUpdates.push({ id: item.id, name: itemName, error: error.message });
    } else if (!data || data.length === 0) {
      
      failedUpdates.push({ id: item.id, name: itemName, error: "Item not found or access denied" });
    } else {
      
      updatedCount++;
    }
  }

  // If unknown updates failed, throw error with details
  if (failedUpdates.length > 0) {
    throw new AIAssistantError(
      `Failed to update ${failedUpdates.length} of ${params.items.length} items`,
      "EXECUTION_FAILED",
      { failedUpdates }
    );
  }

  

  return {

      message: `Successfully updated ${updatedCount} item${updatedCount !== 1 ? "s" : ""}`,
    },

  };
}

export async function executeMenuToggleAvailability(

  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, available")
    .eq("venue_id", venueId)
    .in("id", params.itemIds);

  if (!items || items.length === 0) {
    throw new AIAssistantError("No items found", "INVALID_PARAMS");
  }

  if (preview) {
    return {

      after: items.map((i) => ({ ...i, available: params.available })),

        description: `${items.length} items will be ${params.available ? "shown" : "hidden"}${params.reason ? `: ${params.reason}` : ""}`,
      },
    };
  }

  const { error } = await supabase
    .from("menu_items")
    .update({ available: params.available, updated_at: new Date().toISOString() })
    .in("id", params.itemIds);

  if (error) {
    throw new AIAssistantError("Failed to toggle availability", "EXECUTION_FAILED", { error });
  }

  return {

    result: { updatedCount: params.itemIds.length },

  };
}

export async function executeMenuCreateItem(

        },
      ],

        description: `Will create a new menu item: ${params.name} for £${params.price.toFixed(2)}`,
      },
    };
  }

  // Execute - create the menu item
  const { data: newItem, error } = await supabase
    .from("menu_items")
    .insert({

    .select("id, name, price")
    .single();

  if (error) {
    throw new AIAssistantError("Failed to create menu item", "EXECUTION_FAILED", { error });
  }

  return {

  };
}

export async function executeMenuDeleteItem(

  const { data: currentItem } = await supabase
    .from("menu_items")
    .select("id, name, price")
    .eq("id", params.itemId)
    .eq("venue_id", venueId)
    .single();

  if (!currentItem) {
    throw new AIAssistantError("Menu item not found", "INVALID_PARAMS");
  }

  // Preview mode
  if (preview) {
    return {

        description: `Will delete menu item: ${currentItem.name} (${params.reason || "No reason provided"})`,
      },
    };
  }

  // Execute - delete the menu item
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", params.itemId)
    .eq("venue_id", venueId);

  if (error) {
    throw new AIAssistantError("Failed to delete menu item", "EXECUTION_FAILED", { error });
  }

  return {

    result: { deletedItem: currentItem, reason: params.reason },

  };
}
