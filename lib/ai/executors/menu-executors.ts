import { createAdminClient } from "@/lib/supabase";
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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    throw new AIAssistantError(
      "Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY. Please contact support.",
      "EXECUTION_FAILED",
      { error: errorMessage }
    );
  }

  if (!params.items || params.items.length === 0) {
    throw new AIAssistantError("No items specified for price update", "INVALID_PARAMS");
  }

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

  const foundIds = new Set(currentItems.map((i) => i.id));
  const missingIds = params.items.filter((i) => !foundIds.has(i.id));
  if (missingIds.length > 0) {
    throw new AIAssistantError(
      `Some items not found: ${missingIds.length} items do not exist`,
      "INVALID_PARAMS",
      { missingIds: missingIds.map((i) => i.id) }
    );
  }

  const maxChangePercent = DEFAULT_GUARDRAILS["menu.update_prices"].maxPriceChangePercent || 20;

  for (const item of params.items) {
    const current = currentItems.find((i) => i.id === item.id);
    if (!current) continue;

    if (item.newPrice <= 0) {
      throw new AIAssistantError(
        `Invalid price for ${current.name}: price must be greater than 0`,
        "INVALID_PARAMS",
        { itemId: item.id, itemName: current.name, newPrice: item.newPrice }
      );
    }

    const changePercent = Math.abs(((item.newPrice - current.price) / current.price) * 100);

    if (changePercent > maxChangePercent) {
      throw new AIAssistantError(
        `Price change of ${changePercent.toFixed(1)}% for "${current.name}" exceeds limit of ${maxChangePercent}%`,
        "GUARDRAIL_VIOLATION",
        {

        }
      );
    }
  }

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

  let updatedCount = 0;
  const failedUpdates: unknown[] = [];

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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    throw new AIAssistantError(
      "Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY. Please contact support.",
      "EXECUTION_FAILED",
      { error: errorMessage }
    );
  }

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

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    throw new AIAssistantError(
      "Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY. Please contact support.",
      "EXECUTION_FAILED",
      { error: errorMessage }
    );
  }

  // If categoryId is not a valid UUID, try to find it by category name
  let categoryId = params.categoryId;
  
  // Validate categoryId is provided
  if (!categoryId) {
    throw new AIAssistantError(
      "Category is required. Please specify a category name or ID.",
      "INVALID_PARAMS"
    );
  }
  
  if (categoryId && !categoryId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    // It's a category name, not an ID - look it up (case-insensitive)
    const { data: categories, error: categoryError } = await supabase
      .from("menu_categories")
      .select("id, name")
      .eq("venue_id", venueId);
    
    if (categoryError) {
      
      throw new AIAssistantError(
        `Failed to lookup category: ${categoryError.message}`,
        "EXECUTION_FAILED",
        { error: categoryError }
      );
    }
    
    // Try exact match first (case-insensitive), then partial match
    const category = categories?.find(
      (c) => c.name.toLowerCase() === categoryId.toLowerCase()
    ) || categories?.find(
      (c) => c.name.toLowerCase().includes(categoryId.toLowerCase()) || categoryId.toLowerCase().includes(c.name.toLowerCase())
    );
    
    if (category) {
      categoryId = category.id;
      
    } else {
      const availableCategories = categories?.map((c) => c.name).join(", ") || "none";
      throw new AIAssistantError(
        `Category "${params.categoryId}" not found. Available categories: ${availableCategories}. Please use an existing category name.`,
        "INVALID_PARAMS",
        { availableCategories: categories?.map((c) => c.name) || [] }
      );
    }
  }
  
  // Validate categoryId exists if it's a UUID
  if (categoryId && categoryId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    const { data: categoryExists } = await supabase
      .from("menu_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("venue_id", venueId)
      .single();
    
    if (!categoryExists) {
      throw new AIAssistantError(
        `Category ID "${categoryId}" not found or doesn't belong to this venue.`,
        "INVALID_PARAMS"
      );
    }
  }

  if (preview) {
    return {

        },
      ],

        description: `Will create a new menu item: ${params.name} for £${params.price.toFixed(2)}`,
      },
    };
  }

  const { data: newItem, error } = await supabase
    .from("menu_items")
    .insert({

    .select("id, name, price")
    .single();

  if (error) {
    throw new AIAssistantError(
      `Failed to create menu item: ${error.message}`,
      "EXECUTION_FAILED",
      { error: error.message, details: error }
    );
  }

  return {

      message: `Created menu item: ${newItem.name}`,
      navigateTo: `/dashboard/${venueId}/menu-management?itemId=${newItem.id}&itemName=${encodeURIComponent(newItem.name)}&action=created`,
    },

  };
}

export async function executeMenuDeleteItem(

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    throw new AIAssistantError(
      "Server configuration error: Missing SUPABASE_SERVICE_ROLE_KEY. Please contact support.",
      "EXECUTION_FAILED",
      { error: errorMessage }
    );
  }

  const { data: currentItem } = await supabase
    .from("menu_items")
    .select("id, name, price, category_id, menu_categories(name)")
    .eq("id", params.itemId)
    .eq("venue_id", venueId)
    .single();

  if (!currentItem) {
    throw new AIAssistantError("Menu item not found", "INVALID_PARAMS");
  }

  const categoryId = currentItem.category_id;
  const categoryData = currentItem.menu_categories as { name?: string } | null;
  const categoryName = categoryData?.name;

  if (preview) {
    return {

        description: `Will delete menu item: ${currentItem.name} (${params.reason || "No reason provided"})`,
      },
    };
  }

  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", params.itemId)
    .eq("venue_id", venueId);

  if (error) {
    throw new AIAssistantError("Failed to delete menu item", "EXECUTION_FAILED", { error });
  }

  return {

      categoryId,
      categoryName,
      message: `Deleted ${currentItem.name} from menu`,

          ? `/dashboard/${venueId}/menu-management?categoryId=${categoryId}&categoryName=${encodeURIComponent(categoryName)}&action=deleted`
          : `/dashboard/${venueId}/menu-management?action=deleted`,
    },

  };
}
