import { createAdminClient } from "@/lib/supabase";
import { aiLogger as logger } from "@/lib/logger";
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
  params: MenuUpdatePricesParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[AI ASSISTANT] Failed to create admin client:", errorMessage);
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
    logger.error("[AI ASSISTANT] Error fetching menu items:", fetchError);
    throw new AIAssistantError("Failed to fetch menu items", "EXECUTION_FAILED", {
      error: fetchError,
    });
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
          itemId: item.id,
          itemName: current.name,
          currentPrice: current.price,
          newPrice: item.newPrice,
        }
      );
    }
  }

  if (preview) {
    const before = currentItems.map((i) => ({ id: i.id, name: i.name, price: i.price }));
    const after = currentItems.map((i) => {
      const update = params.items.find((u) => u.id === i.id);
      return {
        id: i.id,
        name: i.name,
        price: update ? update.newPrice : i.price,
      };
    });

    const oldRevenue = before.reduce((sum, i) => sum + i.price, 0);
    const newRevenue = after.reduce((sum, i) => sum + i.price, 0);

    return {
      toolName: "menu.update_prices",
      before,
      after,
      impact: {
        itemsAffected: params.items.length,
        estimatedRevenue: newRevenue - oldRevenue,
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
        price: item.newPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("venue_id", venueId)
      .select("id, name, price");

    if (error) {
      logger.error(`[AI ASSISTANT] Failed to update price for "${itemName}":`, error);
      failedUpdates.push({ id: item.id, name: itemName, error: error.message });
    } else if (!data || data.length === 0) {
      logger.error(`[AI ASSISTANT] No item updated for "${itemName}"`);
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
    success: true,
    toolName: "menu.update_prices",
    result: {
      updatedCount,
      message: `Successfully updated ${updatedCount} item${updatedCount !== 1 ? "s" : ""}`,
    },
    auditId: "",
  };
}

export async function executeMenuToggleAvailability(
  params: MenuToggleAvailabilityParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[AI ASSISTANT] Failed to create admin client:", errorMessage);
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
      toolName: "menu.toggle_availability",
      before: items,
      after: items.map((i) => ({ ...i, available: params.available })),
      impact: {
        itemsAffected: items.length,
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
    success: true,
    toolName: "menu.toggle_availability",
    result: { updatedCount: params.itemIds.length },
    auditId: "",
  };
}

export async function executeMenuCreateItem(
  params: MenuCreateItemParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[AI ASSISTANT] Failed to create admin client:", errorMessage);
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
      logger.error("[AI ASSISTANT] Error fetching categories:", categoryError);
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
      logger.info(`[AI ASSISTANT] Resolved category name "${params.categoryId}" to ID "${categoryId}"`);
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
      toolName: "menu.create_item",
      before: [],
      after: [
        {
          id: "new-item",
          name: params.name,
          price: params.price,
          description: params.description,
          categoryId: categoryId,
          available: params.available,
        },
      ],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: 0,
        description: `Will create a new menu item: ${params.name} for £${params.price.toFixed(2)}`,
      },
    };
  }

  const { data: newItem, error } = await supabase
    .from("menu_items")
    .insert({
      venue_id: venueId,
      name: params.name,
      description: params.description,
      price: params.price,
      category_id: categoryId,
      available: params.available ?? true,
      image_url: params.imageUrl,
      allergens: params.allergens ?? [],
      created_by: _userId,
    })
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
    success: true,
    toolName: "menu.create_item",
    result: {
      ...newItem,
      message: `Created menu item: ${newItem.name}`,
      navigateTo: `/dashboard/${venueId}/menu-management?itemId=${newItem.id}&itemName=${encodeURIComponent(newItem.name)}&action=created`,
    },
    auditId: "",
  };
}

export async function executeMenuDeleteItem(
  params: MenuDeleteItemParams,
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("[AI ASSISTANT] Failed to create admin client:", errorMessage);
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
      toolName: "menu.delete_item",
      before: [currentItem],
      after: [],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: -currentItem.price,
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
    success: true,
    toolName: "menu.delete_item",
    result: {
      deletedItem: currentItem,
      reason: params.reason,
      categoryId,
      categoryName,
      message: `Deleted ${currentItem.name} from menu`,
      navigateTo:
        categoryId && categoryName
          ? `/dashboard/${venueId}/menu-management?categoryId=${categoryId}&categoryName=${encodeURIComponent(categoryName)}&action=deleted`
          : `/dashboard/${venueId}/menu-management?action=deleted`,
    },
    auditId: "",
  };
}
