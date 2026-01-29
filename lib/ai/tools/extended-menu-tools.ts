// Servio AI Assistant - Extended Menu Management Tools
// Image upload, translation, and advanced menu queries

import { createAdminClient } from "@/lib/supabase";

interface MenuItemsWithoutImagesResult {
  items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
  }>;
  count: number;
  summary: string;
}

interface MenuTranslationResult {
  success: boolean;
  itemsTranslated: number;
  targetLanguage: string;
  message: string;
  jobId?: string;
}

interface ImageUploadResult {
  success: boolean;
  itemId: string;
  itemName: string;
  imageUrl: string;
  message: string;
}

/**
 * Query menu items that don't have images
 */
export async function getMenuItemsWithoutImages(
  venueId: string
): Promise<MenuItemsWithoutImagesResult> {
  const supabase = createAdminClient();

  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, category, price, image_url")
    .eq("venue_id", venueId)
    .eq("is_available", true)
    .or("image_url.is.null,image_url.eq.")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch menu items: ${error.message}`);
  }

  const itemsWithoutImages =
    items?.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category || "Uncategorized",
      price: item.price,
    })) || [];

  // Group by category for summary
  const byCategory = itemsWithoutImages.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const categorySummary = Object.entries(byCategory)
    .map(([cat, count]) => `${cat} (${count})`)
    .join(", ");

  return {
    items: itemsWithoutImages,
    count: itemsWithoutImages.length,
    summary:
      itemsWithoutImages.length > 0
        ? `Found ${itemsWithoutImages.length} items without images: ${categorySummary}. Consider adding images to improve menu appeal.`
        : "All menu items have images! Great job!",
  };
}

/**
 * Add/update image for a menu item
 * Note: This prepares the data but actual image upload would need to be handled by the frontend
 */
export async function updateMenuItemImage(
  venueId: string,
  itemName: string,
  imageUrl: string
): Promise<ImageUploadResult> {
  const supabase = createAdminClient();

  // Find the menu item
  const { data: item, error: fetchError } = await supabase
    .from("menu_items")
    .select("id, name")
    .eq("venue_id", venueId)
    .ilike("name", `%${itemName}%`)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Failed to fetch menu item: ${fetchError.message}`);
  }

  if (!item) {
    throw new Error(`Menu item "${itemName}" not found. Please check the name and try again.`);
  }

  // Update the image URL
  const { error: updateError } = await supabase
    .from("menu_items")
    .update({
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  if (updateError) {
    throw new Error(`Failed to update image: ${updateError.message}`);
  }

  return {
    success: true,
    itemId: item.id,
    itemName: item.name,
    imageUrl,
    message: `Successfully added image to "${item.name}". Image URL: ${imageUrl}`,
  };
}

/**
 * Translate menu items to another language
 * Uses chunking to prevent timeout for large menus
 */
export async function translateMenuItems(
  venueId: string,
  targetLanguage: string,
  categories?: string[]
): Promise<MenuTranslationResult> {
  const supabase = createAdminClient();

  // Get items to translate
  let query = supabase
    .from("menu_items")
    .select("id, name, description, category")
    .eq("venue_id", venueId)
    .eq("is_available", true);

  if (categories && categories.length > 0) {
    query = query.in("category", categories);
  }

  const { data: items, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch menu items: ${fetchError.message}`);
  }

  if (!items || items.length === 0) {
    return {
      success: false,
      itemsTranslated: 0,
      targetLanguage,
      message: "No menu items found to translate.",
    };
  }

  // Use existing translation executor which handles chunking
  // Import it dynamically to avoid circular dependencies
  const { executeMenuTranslate } = await import("../executors/translation-executor");

  // Map targetLanguage to language codes
  const langMap: Record<string, string> = {
    spanish: "es",
    english: "en",
    french: "fr",
    german: "de",
    italian: "it",
    portuguese: "pt",
    arabic: "ar",
    chinese: "zh",
    japanese: "ja",
  };

  const langCode = langMap[targetLanguage.toLowerCase()] || targetLanguage;

  // Execute translation with proper timeout handling
  const result = await executeMenuTranslate(
    {
      targetLanguage: langCode as "es" | "ar" | "fr" | "de" | "it" | "pt" | "zh" | "ja",
      includeDescriptions: true,
    },
    venueId,
    "",
    false
  );

  if ("success" in result && result.success) {
    return {
      success: true,
      itemsTranslated: items.length,
      targetLanguage,
      message: `Successfully translated menu to ${targetLanguage}. All ${items.length} items have been updated.`,
    };
  }

  return {
    success: false,
    itemsTranslated: 0,
    targetLanguage,
    message: "Translation failed. Please try again.",
  };
}

/**
 * Helper function to translate text
 * In production, this would call a translation API like Google Translate or DeepL
 */
async function translateText(text: string, targetLanguage: string): Promise<string> {
  // Simplified mock translation
  // In production, integrate with Google Translate API, DeepL, or OpenAI
  const languageMap: Record<string, string> = {
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    portuguese: "pt",
    chinese: "zh",
    japanese: "ja",
  };

  const langCode = languageMap[targetLanguage.toLowerCase()] || targetLanguage;

  // Mock translation - in production, call actual API

  // For now, just return with a language prefix to show it "worked"
  return `[${langCode.toUpperCase()}] ${text}`;
}

/**
 * Bulk update menu item availability
 */
export async function bulkUpdateAvailability(
  venueId: string,
  itemIds: string[],
  available: boolean
): Promise<{
  success: boolean;
  updatedCount: number;
  message: string;
}> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("menu_items")
    .update({
      is_available: available,
      updated_at: new Date().toISOString(),
    })
    .in("id", itemIds)
    .eq("venue_id", venueId)
    .select("id");

  if (error) {
    throw new Error(`Failed to update availability: ${error.message}`);
  }

  return {
    success: true,
    updatedCount: data?.length || 0,
    message: `Successfully ${available ? "enabled" : "disabled"} ${data?.length || 0} menu items.`,
  };
}
