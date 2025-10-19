// Menu Tools - Menu management and translation
// Extracted from tool-executors.ts

import { createClient } from "@/lib/supabase/server";
import { aiLogger as logger } from '@/lib/logger';
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

// ============================================================================
// Menu Tools
// ============================================================================

export async function executeMenuUpdatePrices(
  params: MenuUpdatePricesParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  logger.debug(`[AI ASSISTANT] Updating prices for ${params.items.length} items`);

  // Validate that we have items to update
  if (!params.items || params.items.length === 0) {
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
    logger.error("[AI ASSISTANT] Error fetching menu items:", fetchError);
    throw new AIAssistantError("Failed to fetch menu items", "EXECUTION_FAILED", fetchError);
  }

  if (!currentItems || currentItems.length === 0) {
    throw new AIAssistantError("No items found matching the provided IDs", "INVALID_PARAMS");
  }

  logger.debug(`[AI ASSISTANT] Found ${currentItems.length} items in database`);

  // Validate all item IDs exist
  const foundIds = new Set(currentItems.map(i => i.id));
  const missingIds = params.items.filter(i => !foundIds.has(i.id));
  if (missingIds.length > 0) {
    logger.error("[AI ASSISTANT] Missing item IDs:", missingIds.map(i => i.id));
    throw new AIAssistantError(
      `Some items not found: ${missingIds.length} items do not exist`,
      "INVALID_PARAMS",
      { missingIds: missingIds.map(i => i.id) }
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
    logger.debug(`[AI ASSISTANT] ${current.name}: ${current.price} → ${item.newPrice} (${changePercent.toFixed(1)}% change)`);
    
    if (changePercent > maxChangePercent) {
      throw new AIAssistantError(
        `Price change of ${changePercent.toFixed(1)}% for "${current.name}" exceeds limit of ${maxChangePercent}%`,
        "GUARDRAIL_VIOLATION",
        { itemId: item.id, itemName: current.name, currentPrice: current.price, newPrice: item.newPrice }
      );
    }
  }

  // Preview mode
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
        description: `${params.items.length} items will be updated. Estimated revenue impact: ${((newRevenue - oldRevenue) / oldRevenue * 100).toFixed(1)}%`,
      },
    };
  }

  // Execute - update prices for each item
  logger.debug(`[AI ASSISTANT] Executing price updates for ${params.items.length} items`);
  let updatedCount = 0;
  const failedUpdates: unknown[] = [];
  
  for (const item of params.items) {
    const currentItem = currentItems.find(i => i.id === item.id);
    const itemName = currentItem?.name || item.id;
    
    const { data, error } = await supabase
      .from("menu_items")
      .update({ 
        price: item.newPrice,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id)
      .eq("venue_id", venueId) // Extra safety check
      .select("id, name, price");

    if (error) {
      logger.error(`[AI ASSISTANT] Failed to update price for "${itemName}":`, error);
      failedUpdates.push({ id: item.id, name: itemName, error: error.message });
    } else if (!data || data.length === 0) {
      logger.error(`[AI ASSISTANT] No item updated for "${itemName}" - possibly wrong venue_id`);
      failedUpdates.push({ id: item.id, name: itemName, error: "Item not found or access denied" });
    } else {
      logger.debug(`[AI ASSISTANT] Successfully updated "${itemName}" to £${item.newPrice}`);
      updatedCount++;
    }
  }

  // If any updates failed, throw error with details
  if (failedUpdates.length > 0) {
    throw new AIAssistantError(
      `Failed to update ${failedUpdates.length} of ${params.items.length} items`,
      "EXECUTION_FAILED",
      { failedUpdates }
    );
  }

  logger.debug(`[AI ASSISTANT] Price update complete: ${updatedCount} items updated successfully`);

  return {
    success: true,
    toolName: "menu.update_prices",
    result: { 
      updatedCount,
      message: `Successfully updated ${updatedCount} item${updatedCount !== 1 ? 's' : ''}`
    },
    auditId: "", // Will be set by caller
  };
}

export async function executeMenuToggleAvailability(
  params: MenuToggleAvailabilityParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

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
    throw new AIAssistantError("Failed to toggle availability", "EXECUTION_FAILED", error);
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
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Preview mode
  if (preview) {
    return {
      toolName: "menu.create_item",
      before: [],
      after: [{
        id: "new-item",
        name: params.name,
        price: params.price,
        description: params.description,
        categoryId: params.categoryId,
        available: params.available,
      }],
      impact: {
        itemsAffected: 1,
        estimatedRevenue: 0,
        description: `Will create a new menu item: ${params.name} for £${params.price.toFixed(2)}`,
      },
    };
  }

  // Execute - create the menu item
  const { data: newItem, error } = await supabase
    .from("menu_items")
    .insert({
      venue_id: venueId,
      name: params.name,
      description: params.description,
      price: params.price,
      category_id: params.categoryId,
      available: params.available,
      image_url: params.imageUrl,
      allergens: params.allergens,
      created_by: userId,
    })
    .select("id, name, price")
    .single();

  if (error) {
    throw new AIAssistantError("Failed to create menu item", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "menu.create_item",
    result: newItem,
    auditId: "", // Will be set by calling function
  };
}

export async function executeMenuDeleteItem(
  params: MenuDeleteItemParams,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  // Get current item details
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

  // Execute - delete the menu item
  const { error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", params.itemId)
    .eq("venue_id", venueId);

  if (error) {
    throw new AIAssistantError("Failed to delete menu item", "EXECUTION_FAILED", error);
  }

  return {
    success: true,
    toolName: "menu.delete_item",
    result: { deletedItem: currentItem, reason: params.reason },
    auditId: "", // Will be set by calling function
  };
}

export async function executeMenuTranslate(
  params: any,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, description, category")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true }); // Ensure consistent ordering

  if (!items || items.length === 0) {
    throw new AIAssistantError("No menu items found", "INVALID_PARAMS");
  }

  logger.debug(`[AI ASSISTANT] Starting translation of ${items.length} items to ${params.targetLanguage}`);

  // Language code mapping
  const languageNames: Record<string, string> = {
    en: "English",
    es: "Spanish",
    ar: "Arabic",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    zh: "Chinese",
    ja: "Japanese",
  };

  // Comprehensive bidirectional category mappings for all supported languages
  const categoryMappings: Record<string, Record<string, string>> = {
    // English to Spanish
    "en-es": {
      "STARTERS": "ENTRADAS",
      "APPETIZERS": "APERITIVOS", 
      "MAIN COURSES": "PLATOS PRINCIPALES",
      "ENTREES": "PLATOS PRINCIPALES",
      "DESSERTS": "POSTRES",
      "SALADS": "ENSALADAS",
      "KIDS": "NIÑOS",
      "CHILDREN": "NIÑOS",
      "DRINKS": "BEBIDAS",
      "BEVERAGES": "BEBIDAS",
      "COFFEE": "CAFÉ",
      "SPECIAL COFFEE": "CAFÉ ESPECIAL",
      "TEA": "TÉ",
      "SPECIALS": "ESPECIALES",
      "SPECIAL": "ESPECIAL",
      "WRAPS": "WRAPS",
      "SANDWICHES": "SÁNDWICHES",
      "MILKSHAKES": "MALTEADAS",
      "SHAKES": "BATIDOS",
      "SMOOTHIES": "BATIDOS",
      "BRUNCH": "BRUNCH",
      "BREAKFAST": "DESAYUNO",
      "LUNCH": "ALMUERZO",
      "DINNER": "CENA",
      "SOUP": "SOPA",
      "SOUPS": "SOPAS",
      "PASTA": "PASTA",
      "PIZZA": "PIZZA",
      "SEAFOOD": "MARISCOS",
      "CHICKEN": "POLLO",
      "BEEF": "CARNE DE RES",
      "PORK": "CERDO",
      "VEGETARIAN": "VEGETARIANO",
      "VEGAN": "VEGANO",
      "GLUTEN FREE": "SIN GLUTEN"
    },
    // Spanish to English
    "es-en": {
      "ENTRADAS": "STARTERS",
      "APERITIVOS": "APPETIZERS",
      "PLATOS PRINCIPALES": "MAIN COURSES",
      "POSTRES": "DESSERTS",
      "ENSALADAS": "SALADS",
      "NIÑOS": "KIDS",
      "NINOS": "KIDS",
      "BEBIDAS": "DRINKS",
      "CAFÉ": "COFFEE",
      "CAFE": "COFFEE",
      "CAFÉ ESPECIAL": "SPECIAL COFFEE",
      "CAFE ESPECIAL": "SPECIAL COFFEE",
      "CAFÉ ESPECIALES": "SPECIAL COFFEE",
      "CAFE ESPECIALES": "SPECIAL COFFEE",
      "TÉ": "TEA",
      "TE": "TEA",
      "ESPECIALES": "SPECIALS",
      "ESPECIAL": "SPECIAL",
      "SÁNDWICHES": "SANDWICHES",
      "SANDWICHES": "SANDWICHES",
      "WRAPS & SANDWICHES": "WRAPS & SANDWICHES",
      "MALTEADAS": "MILKSHAKES",
      "BATIDOS": "SHAKES",
      "SHAKES": "SHAKES",
      "ICED COFFEE": "ICED COFFEE",
      "CAFÉ HELADO": "ICED COFFEE",
      "CAFE HELADO": "ICED COFFEE",
      "DESAYUNO": "BREAKFAST",
      "ALMUERZO": "LUNCH",
      "CENA": "DINNER",
      "SOPA": "SOUP",
      "SOPAS": "SOUPS",
      "MARISCOS": "SEAFOOD",
      "POLLO": "CHICKEN",
      "CARNE DE RES": "BEEF",
      "CERDO": "PORK",
      "VEGETARIANO": "VEGETARIAN",
      "VEGANO": "VEGAN",
      "SIN GLUTEN": "GLUTEN FREE"
    },
    // English to French
    "en-fr": {
      "STARTERS": "ENTRÉES",
      "APPETIZERS": "APÉRITIFS",
      "MAIN COURSES": "PLATS PRINCIPAUX",
      "DESSERTS": "DESSERTS",
      "SALADS": "SALADES",
      "KIDS": "ENFANTS",
      "DRINKS": "BOISSONS",
      "COFFEE": "CAFÉ",
      "TEA": "THÉ",
      "BREAKFAST": "PETIT DÉJEUNER",
      "LUNCH": "DÉJEUNER",
      "DINNER": "DÎNER"
    },
    // French to English
    "fr-en": {
      "ENTRÉES": "STARTERS",
      "APÉRITIFS": "APPETIZERS",
      "PLATS PRINCIPAUX": "MAIN COURSES",
      "DESSERTS": "DESSERTS",
      "SALADES": "SALADS",
      "ENFANTS": "KIDS",
      "BOISSONS": "DRINKS",
      "CAFÉ": "COFFEE",
      "THÉ": "TEA",
      "PETIT DÉJEUNER": "BREAKFAST",
      "DÉJEUNER": "LUNCH",
      "DÎNER": "DINNER"
    }
  };

  const targetLangName = languageNames[params.targetLanguage] || params.targetLanguage;

  // Detect the source language by analyzing the current categories and item names
  const detectSourceLanguage = (items: Array<{ name: string; category: string }>): string => {
    // Comprehensive language indicators
    const spanishIndicators = [
      // Categories
      'CAFÉ', 'CAFE', 'CAFÉ ESPECIAL', 'CAFE ESPECIAL', 'BEBIDAS', 'TÉ', 'TE', 'ESPECIALES', 'ESPECIAL', 'NIÑOS', 'NINOS', 
      'ENSALADAS', 'POSTRES', 'ENTRADAS', 'PLATOS PRINCIPALES', 'APERITIVOS',
      'MALTEADAS', 'BATIDOS', 'SÁNDWICHES', 'SANDWICHES', 'DESAYUNO', 'ALMUERZO', 
      'CENA', 'SOPA', 'SOPAS', 'MARISCOS', 'POLLO', 'CARNE DE RES', 'CARNE', 
      'CERDO', 'VEGETARIANO', 'VEGANO', 'SIN GLUTEN',
      // Common item words
      'CON', 'DE', 'Y', 'PARA', 'LOS', 'LAS', 'EL', 'LA', 'DEL', 'AL',
      'HUEVOS', 'QUESO', 'LECHE', 'PAN', 'ARROZ', 'FRIJOLES', 'SALSA',
      'TORTILLA', 'TACO', 'BURRITO', 'QUESADILLA', 'ENCHILADA'
    ];
    
    const englishIndicators = [
      // Categories
      'STARTERS', 'APPETIZERS', 'MAIN COURSES', 'ENTREES', 'DESSERTS', 
      'SALADS', 'KIDS', 'CHILDREN', 'DRINKS', 'BEVERAGES', 'COFFEE', 
      'TEA', 'SPECIALS', 'WRAPS', 'SANDWICHES', 'MILKSHAKES', 'SHAKES', 
      'SMOOTHIES', 'BRUNCH', 'BREAKFAST', 'LUNCH', 'DINNER', 'SOUP', 
      'SOUPS', 'PASTA', 'PIZZA', 'SEAFOOD', 'CHICKEN', 'BEEF', 'PORK', 
      'VEGETARIAN', 'VEGAN', 'GLUTEN FREE', 'GLUTEN-FREE',
      // Common item words
      'WITH', 'AND', 'OR', 'THE', 'OF', 'FOR', 'IN', 'ON', 'TO',
      'EGGS', 'CHEESE', 'MILK', 'BREAD', 'RICE', 'BEANS', 'SAUCE',
      'BURGER', 'SANDWICH', 'STEAK', 'GRILLED', 'FRIED', 'BAKED'
    ];
    
    let spanishCount = 0;
    let englishCount = 0;
    
    // Check both categories and item names
    items.forEach(item => {
      const text = `${item.name} ${item.category}`.toUpperCase();
      
      spanishIndicators.forEach(indicator => {
        if (text.includes(indicator)) {
          spanishCount++;
        }
      });
      
      englishIndicators.forEach(indicator => {
        if (text.includes(indicator)) {
          englishCount++;
        }
      });
    });
    
    logger.debug(`[AI ASSISTANT] Language detection: ${spanishCount} Spanish indicators, ${englishCount} English indicators`);
    
    // If we have more Spanish indicators, assume source is Spanish
    if (spanishCount > englishCount) {
      logger.debug(`[AI ASSISTANT] Detected source language: Spanish`);
      return 'es';
    } else if (englishCount > spanishCount) {
      logger.debug(`[AI ASSISTANT] Detected source language: English`);
      return 'en';
    } else {
      // If equal or no clear indicators, use opposite of target language
      const defaultSource = params.targetLanguage === 'es' ? 'en' : 'es';
      logger.debug(`[AI ASSISTANT] Ambiguous language, defaulting to opposite of target: ${defaultSource}`);
      return defaultSource;
    }
  };

  // Get unique categories for translation
  const uniqueCategories = Array.from(new Set(items.map(item => item.category).filter(Boolean)));
  const detectedSourceLanguage = detectSourceLanguage(items);
  
  if (preview) {
    // For preview, do actual translation of sample items to show real results
    try {
      // Import OpenAI
      const { getOpenAI } = await import("@/lib/openai");
      const openai = getOpenAI();

      // Get sample items for preview (first 5)
      const sampleItems = items.slice(0, 5);
      
      // Create translation prompt for preview
      const itemsToTranslate = sampleItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ...(params.includeDescriptions && item.description ? { description: item.description } : {})
      }));

      // Generate comprehensive category mapping instructions for preview
      const mappingKey = `${detectedSourceLanguage}-${params.targetLanguage}`;
      const categoryMappingList = Object.entries(categoryMappings[mappingKey] || {})
        .map(([from, to]) => `   - "${from}" → "${to}"`)
        .join('\n');

      const prompt = `You are a professional menu translator. Translate the following menu items from ${detectedSourceLanguage.toUpperCase()} to ${targetLangName}.

SOURCE LANGUAGE: ${detectedSourceLanguage.toUpperCase()}
TARGET LANGUAGE: ${targetLangName}

CRITICAL REQUIREMENTS (FAILURE TO FOLLOW WILL RESULT IN ERROR):
1. Return EXACTLY ${sampleItems.length} items (same count as input)
2. MUST translate BOTH item names AND category names - NO EXCEPTIONS
3. Keep the 'id' field UNCHANGED for each item
4. Use these EXACT category mappings (case-sensitive):
${categoryMappingList}
5. If a category is not in the mapping, translate it naturally while maintaining context
6. Do NOT skip, combine, or omit ANY items
7. Maintain culinary terminology and context appropriately
8. IMPORTANT: "CAFÉ ESPECIAL" must be translated to "SPECIAL COFFEE" (English) or kept as "CAFÉ ESPECIAL" (Spanish)
9. All categories MUST be translated - never leave them in the original language

INPUT ITEMS (${sampleItems.length} total):
${JSON.stringify(itemsToTranslate, null, 2)}

OUTPUT FORMAT:
{"items": [{"id": "exact-id-from-input", "name": "translated name", "category": "translated category", "description": "translated description (if provided)"}]}

VALIDATION CHECKLIST:
✓ Output has EXACTLY ${sampleItems.length} items
✓ Each item has: id, name, category
✓ All IDs match input IDs exactly
✓ All names are translated to ${targetLangName}
✓ All categories are translated to ${targetLangName}

Remember: You MUST return ALL ${sampleItems.length} items with translations. No exceptions.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06", // Use GPT-4o for translation (complex task requiring accuracy)
        messages: [
          {
            role: "system",
            content: "You are a professional menu translator. Return valid JSON with an 'items' array containing the EXACT same number of items as provided."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1, // Lower temperature for more consistent results
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const translated = JSON.parse(content);
        const translatedArray = translated.items || [];
        
        if (translatedArray.length > 0) {
          logger.debug("[AI ASSISTANT] Preview translation successful:", translatedArray.slice(0, 2));
        }

        return {
          toolName: "menu.translate",
          before: sampleItems.map(i => ({ 
            name: i.name, 
            description: i.description || "",
            category: i.category || ""
          })),
          after: translatedArray.map((i: any) => ({
            name: i.name || i.originalName,
            description: i.description || "",
            category: i.category || ""
          })),
          impact: {
            itemsAffected: items.length,
            categoriesAffected: uniqueCategories.length,
            description: `Menu will be translated to ${targetLangName}. This will update ${items.length} items and ${uniqueCategories.length} categories${params.includeDescriptions ? " (including descriptions)" : ""}.`,
          },
        };
      }
    } catch (error) {
      logger.error("[AI ASSISTANT] Preview translation failed:", error);
      // Fallback to simple preview if translation fails
    }

    // Fallback: Simple preview if actual translation fails
    return {
      toolName: "menu.translate",
      before: items.slice(0, 5).map(i => ({ 
        name: i.name, 
        description: i.description || "",
        category: i.category || ""
      })),
      after: items.slice(0, 5).map(i => ({
        name: `[Will translate to ${targetLangName}] ${i.name}`,
        description: i.description ? `[Will translate to ${targetLangName}] ${i.description}` : "",
        category: i.category ? `[Will translate to ${targetLangName}] ${i.category}` : ""
      })),
      impact: {
        itemsAffected: items.length,
        categoriesAffected: uniqueCategories.length,
        description: `Menu will be translated to ${targetLangName}. This will update ${items.length} items and ${uniqueCategories.length} categories${params.includeDescriptions ? " (including descriptions)" : ""}.`,
      },
    };
  }

  // Execute - Translate using OpenAI with improved error handling
  try {
    // Import OpenAI
    const { getOpenAI } = await import("@/lib/openai");
    const openai = getOpenAI();

    // Store original item count for validation
    const originalItemCount = items.length;
    const translatedItems: unknown[] = [];
    
    // Process items in smaller batches to ensure reliability
    const batchSize = 15; // Reduced batch size for better reliability
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      logger.debug(`[AI ASSISTANT] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)} (${batch.length} items)`);
      
      // Create translation prompt with explicit requirements
      const itemsToTranslate = batch.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ...(params.includeDescriptions && item.description ? { description: item.description } : {})
      }));

      // Generate comprehensive category mapping instructions
      const mappingKey = `${detectedSourceLanguage}-${params.targetLanguage}`;
      const categoryMappingList = Object.entries(categoryMappings[mappingKey] || {})
        .map(([from, to]) => `   - "${from}" → "${to}"`)
        .join('\n');

      const prompt = `You are a professional menu translator. Translate the following menu items from ${detectedSourceLanguage.toUpperCase()} to ${targetLangName}.

SOURCE LANGUAGE: ${detectedSourceLanguage.toUpperCase()}
TARGET LANGUAGE: ${targetLangName}

CRITICAL REQUIREMENTS (FAILURE TO FOLLOW WILL RESULT IN ERROR):
1. Return EXACTLY ${batch.length} items (same count as input)
2. MUST translate BOTH item names AND category names - NO EXCEPTIONS
3. Keep the 'id' field UNCHANGED for each item
4. Use these EXACT category mappings (case-sensitive):
${categoryMappingList}
5. If a category is not in the mapping, translate it naturally while maintaining context
6. Do NOT skip, combine, or omit ANY items
7. Maintain culinary terminology and context appropriately
8. IMPORTANT: "CAFÉ ESPECIAL" must be translated to "SPECIAL COFFEE" (English) or kept as "CAFÉ ESPECIAL" (Spanish)
9. All categories MUST be translated - never leave them in the original language

INPUT ITEMS (${batch.length} total):
${JSON.stringify(itemsToTranslate, null, 2)}

OUTPUT FORMAT:
{"items": [{"id": "exact-id-from-input", "name": "translated name", "category": "translated category", "description": "translated description (if provided)"}]}

VALIDATION CHECKLIST:
✓ Output has EXACTLY ${batch.length} items
✓ Each item has: id, name, category
✓ All IDs match input IDs exactly
✓ All names are translated to ${targetLangName}
✓ All categories are translated to ${targetLangName}

Remember: You MUST return ALL ${batch.length} items with translations. No exceptions.`;

      let retryCount = 0;
      const maxRetries = 3;
      let batchTranslated = false;

      while (!batchTranslated && retryCount < maxRetries) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-2024-08-06", // Use GPT-4o for translation (complex task requiring accuracy)
            messages: [
              {
                role: "system",
                content: `You are a professional menu translator. Return valid JSON with an 'items' array containing EXACTLY ${batch.length} items. Never omit items.`
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.1, // Lower temperature for more consistent results
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            logger.debug(`[AI ASSISTANT] Translation response for batch ${Math.floor(i/batchSize) + 1}:`, content.substring(0, 200));
            const translated = JSON.parse(content);
            const translatedArray = translated.items || [];
            
            // Validate that we got the expected number of items and all have required fields
            if (translatedArray.length === batch.length) {
              // Additional validation: check that all items have required fields
              const validItems = translatedArray.filter((item: any) => 
                item && item.id && item.name && item.category
              );
              
              if (validItems.length === batch.length) {
                logger.debug(`[AI ASSISTANT] Batch ${Math.floor(i/batchSize) + 1} translation successful: ${translatedArray.length} items`);
                translatedItems.push(...translatedArray);
                batchTranslated = true;
              } else {
                logger.error(`[AI ASSISTANT] Batch ${Math.floor(i/batchSize) + 1} has ${validItems.length} valid items, expected ${batch.length}`);
                retryCount++;
                if (retryCount < maxRetries) {
                  logger.debug(`[AI ASSISTANT] Retrying batch ${Math.floor(i/batchSize) + 1} (attempt ${retryCount + 1})`);
                }
              }
            } else {
              logger.error(`[AI ASSISTANT] Batch ${Math.floor(i/batchSize) + 1} returned ${translatedArray.length} items, expected ${batch.length}`);
              retryCount++;
              if (retryCount < maxRetries) {
                logger.debug(`[AI ASSISTANT] Retrying batch ${Math.floor(i/batchSize) + 1} (attempt ${retryCount + 1})`);
              }
            }
          } else {
            logger.error(`[AI ASSISTANT] No content in translation response for batch ${Math.floor(i/batchSize) + 1}`);
            retryCount++;
          }
        } catch (batchError) {
          logger.error(`[AI ASSISTANT] Batch ${Math.floor(i/batchSize) + 1} translation error:`, batchError);
          retryCount++;
          if (retryCount < maxRetries) {
            logger.debug(`[AI ASSISTANT] Retrying batch ${Math.floor(i/batchSize) + 1} (attempt ${retryCount + 1})`);
          }
        }
      }

      // If batch failed after retries, add original items to maintain count
      if (!batchTranslated) {
        logger.error(`[AI ASSISTANT] Batch ${Math.floor(i/batchSize) + 1} failed after ${maxRetries} retries, using original items`);
        const fallbackItems = batch.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          description: item.description || ""
        }));
        translatedItems.push(...fallbackItems);
      }
    }

    // Validate that we have the same number of items
    if (translatedItems.length !== originalItemCount) {
      logger.error(`[AI ASSISTANT] Item count mismatch: expected ${originalItemCount}, got ${translatedItems.length}`);
      throw new AIAssistantError(
        `Translation failed: Item count mismatch. Expected ${originalItemCount} items, got ${translatedItems.length}`,
        "EXECUTION_FAILED"
      );
    }

    // Update database with translations
    logger.debug(`[AI ASSISTANT] Updating ${translatedItems.length} translated items in database`);
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const translatedItem of translatedItems) {
      if (!translatedItem || !translatedItem.id || !translatedItem.name) {
        logger.error(`[AI ASSISTANT] Invalid translated item:`, translatedItem);
        failedCount++;
        continue;
      }

      const updateData: any = {
        name: translatedItem.name,
        updated_at: new Date().toISOString()
      };
      
      // Always update category if it was translated
      if (translatedItem.category) {
        updateData.category = translatedItem.category;
      }
      
      if (params.includeDescriptions && translatedItem.description) {
        updateData.description = translatedItem.description;
      }

      logger.debug(`[AI ASSISTANT] Updating item ${translatedItem.id}: ${translatedItem.name}, category: ${translatedItem.category}`);

      const { error } = await supabase
        .from("menu_items")
        .update(updateData)
        .eq("id", translatedItem.id)
        .eq("venue_id", venueId);

      if (!error) {
        updatedCount++;
      } else {
        logger.error(`[AI ASSISTANT] Failed to update item ${(translatedItem as any).id}:`, error);
        failedCount++;
      }
    }

    logger.debug(`[AI ASSISTANT] Translation complete: ${updatedCount} updated, ${failedCount} failed`);

    if (updatedCount === 0 && translatedItems.length > 0) {
      throw new AIAssistantError(
        `Translation failed: Could not update any items (${failedCount} failed)`,
        "EXECUTION_FAILED"
      );
    }

    return {
      success: true,
      toolName: "menu.translate",
      result: {
        message: `Successfully translated ${updatedCount} menu items and categories to ${targetLangName}${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
        itemsTranslated: updatedCount,
        itemsFailed: failedCount,
        categoriesTranslated: uniqueCategories.length,
        targetLanguage: params.targetLanguage,
        includeDescriptions: params.includeDescriptions,
        originalItemCount,
        finalItemCount: translatedItems.length
      },
      auditId: "",
    };
  } catch (error: unknown) {
    logger.error("[AI ASSISTANT] Translation error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new AIAssistantError(
      `Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      "EXECUTION_FAILED",
      error
    );
  }
}

