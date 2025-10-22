import { errorToContext } from '@/lib/utils/error-to-context';

import { createClient } from "@/lib/supabase";
import { aiLogger as logger } from '@/lib/logger';
import { AIPreviewDiff, AIExecutionResult, AIAssistantError } from "@/types/ai-assistant";

const LANGUAGE_NAMES: Record<string, string> = {
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

const CATEGORY_MAPPINGS: Record<string, Record<string, string>> = {
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
    "TÉ": "TEA",
    "TE": "TEA",
    "ESPECIALES": "SPECIALS",
    "ESPECIAL": "SPECIAL",
    "SÁNDWICHES": "SANDWICHES",
    "SANDWICHES": "SANDWICHES",
    "MALTEADAS": "MILKSHAKES",
    "BATIDOS": "SHAKES",
    "SHAKES": "SHAKES",
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
  }
};

function detectSourceLanguage(items: Array<{ name: string; category: string }>, targetLanguage: string): string {
  const spanishIndicators = [
    'CAFÉ', 'CAFE', 'BEBIDAS', 'TÉ', 'TE', 'ESPECIALES', 'ESPECIAL', 'NIÑOS', 'NINOS',
    'ENSALADAS', 'POSTRES', 'ENTRADAS', 'PLATOS PRINCIPALES', 'APERITIVOS',
    'MALTEADAS', 'BATIDOS', 'SÁNDWICHES', 'SANDWICHES', 'DESAYUNO', 'ALMUERZO',
    'CENA', 'SOPA', 'SOPAS', 'MARISCOS', 'POLLO', 'CARNE DE RES', 'CERDO',
    'VEGETARIANO', 'VEGANO', 'SIN GLUTEN',
    'CON', 'DE', 'Y', 'PARA', 'LOS', 'LAS', 'EL', 'LA', 'DEL', 'AL',
    'HUEVOS', 'QUESO', 'LECHE', 'PAN', 'ARROZ', 'FRIJOLES', 'SALSA',
    'TORTILLA', 'TACO', 'BURRITO', 'QUESADILLA', 'ENCHILADA'
  ];
  
  const englishIndicators = [
    'STARTERS', 'APPETIZERS', 'MAIN COURSES', 'ENTREES', 'DESSERTS',
    'SALADS', 'KIDS', 'CHILDREN', 'DRINKS', 'BEVERAGES', 'COFFEE',
    'TEA', 'SPECIALS', 'WRAPS', 'SANDWICHES', 'MILKSHAKES', 'SHAKES',
    'SMOOTHIES', 'BRUNCH', 'BREAKFAST', 'LUNCH', 'DINNER', 'SOUP',
    'SOUPS', 'PASTA', 'PIZZA', 'SEAFOOD', 'CHICKEN', 'BEEF', 'PORK',
    'VEGETARIAN', 'VEGAN', 'GLUTEN FREE', 'GLUTEN-FREE',
    'WITH', 'AND', 'OR', 'THE', 'OF', 'FOR', 'IN', 'ON', 'TO',
    'EGGS', 'CHEESE', 'MILK', 'BREAD', 'RICE', 'BEANS', 'SAUCE',
    'BURGER', 'SANDWICH', 'STEAK', 'GRILLED', 'FRIED', 'BAKED'
  ];
  
  let spanishCount = 0;
  let englishCount = 0;
  
  items.forEach(item => {
    const text = `${item.name} ${item.category}`.toUpperCase();
    
    spanishIndicators.forEach(indicator => {
      if (text.includes(indicator)) spanishCount++;
    });
    
    englishIndicators.forEach(indicator => {
      if (text.includes(indicator)) englishCount++;
    });
  });
  
  if (spanishCount > englishCount) return 'es';
  if (englishCount > spanishCount) return 'en';
  return targetLanguage === 'es' ? 'en' : 'es';
}

export async function executeMenuTranslate(
  params: unknown,
  venueId: string,
  userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("menu_items")
    .select("id, name, description, category")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });

  if (!items || items.length === 0) {
    throw new AIAssistantError("No menu items found", "INVALID_PARAMS");
  }

  logger.debug(`[AI ASSISTANT] Starting translation of ${items.length} items to ${params.targetLanguage}`);

  const targetLangName = LANGUAGE_NAMES[params.targetLanguage] || params.targetLanguage;
  const uniqueCategories = Array.from(new Set(items.map(item => item.category).filter(Boolean)));
  const detectedSourceLanguage = detectSourceLanguage(items, params.targetLanguage);
  
  if (preview) {
    try {
      const { getOpenAI } = await import("@/lib/openai");
      const openai = getOpenAI();

      const sampleItems = items.slice(0, 5);
      
      const itemsToTranslate = sampleItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ...(params.includeDescriptions && item.description ? { description: item.description } : {})
      }));

      const mappingKey = `${detectedSourceLanguage}-${params.targetLanguage}`;
      const categoryMappingList = Object.entries(CATEGORY_MAPPINGS[mappingKey] || {})
        .map(([from, to]) => `   - "${from}" → "${to}"`)
        .join('\n');

      const prompt = `You are a professional menu translator. Translate the following menu items from ${detectedSourceLanguage.toUpperCase()} to ${targetLangName}.

SOURCE LANGUAGE: ${detectedSourceLanguage.toUpperCase()}
TARGET LANGUAGE: ${targetLangName}

CRITICAL REQUIREMENTS:
1. Return EXACTLY ${sampleItems.length} items
2. MUST translate BOTH item names AND category names
3. Keep the 'id' field UNCHANGED
4. Use these EXACT category mappings:
${categoryMappingList}
5. If a category is not in the mapping, translate it naturally
6. Do NOT skip, combine, or omit ANY items
7. Maintain culinary terminology appropriately
8. All categories MUST be translated

INPUT ITEMS (${sampleItems.length} total):
${JSON.stringify(itemsToTranslate, null, 2)}

OUTPUT FORMAT:
{"items": [{"id": "exact-id-from-input", "name": "translated name", "category": "translated category", "description": "translated description (if provided)"}]}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
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
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const translated = JSON.parse(content);
        const translatedArray = translated.items || [];
        
        return {
          toolName: "menu.translate",
          before: sampleItems.map(i => ({ 
            name: i.name, 
            description: i.description || "",
            category: i.category || ""
          })),
          after: translatedArray.map((i: unknown) => ({
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
    }

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

  // Execute translation
  try {
    const { getOpenAI } = await import("@/lib/openai");
    const openai = getOpenAI();

    const originalItemCount = items.length;
    const translatedItems: unknown[] = [];
    const batchSize = 15;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      logger.debug(`[AI ASSISTANT] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)}`);
      
      const itemsToTranslate = batch.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        ...(params.includeDescriptions && item.description ? { description: item.description } : {})
      }));

      const mappingKey = `${detectedSourceLanguage}-${params.targetLanguage}`;
      const categoryMappingList = Object.entries(CATEGORY_MAPPINGS[mappingKey] || {})
        .map(([from, to]) => `   - "${from}" → "${to}"`)
        .join('\n');

      const prompt = `You are a professional menu translator. Translate the following menu items from ${detectedSourceLanguage.toUpperCase()} to ${targetLangName}.

SOURCE LANGUAGE: ${detectedSourceLanguage.toUpperCase()}
TARGET LANGUAGE: ${targetLangName}

CRITICAL REQUIREMENTS:
1. Return EXACTLY ${batch.length} items
2. MUST translate BOTH item names AND category names
3. Keep the 'id' field UNCHANGED
4. Use these EXACT category mappings:
${categoryMappingList}
5. If a category is not in the mapping, translate it naturally
6. Do NOT skip, combine, or omit ANY items
7. Maintain culinary terminology appropriately
8. All categories MUST be translated

INPUT ITEMS (${batch.length} total):
${JSON.stringify(itemsToTranslate, null, 2)}

OUTPUT FORMAT:
{"items": [{"id": "exact-id-from-input", "name": "translated name", "category": "translated category", "description": "translated description (if provided)"}]}`;

      let retryCount = 0;
      const maxRetries = 3;
      let batchTranslated = false;

      while (!batchTranslated && retryCount < maxRetries) {
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-2024-08-06",
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
            temperature: 0.1,
            response_format: { type: "json_object" },
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            const translated = JSON.parse(content);
            const translatedArray = translated.items || [];
            
            if (translatedArray.length === batch.length) {
              const validItems = translatedArray.filter((item: Record<string, unknown>) => 
                item && item.id && item.name && item.category
              );
              
              if (validItems.length === batch.length) {
                translatedItems.push(...translatedArray);
                batchTranslated = true;
              } else {
                retryCount++;
              }
            } else {
              retryCount++;
            }
          } else {
            retryCount++;
          }
        } catch (batchError) {
          logger.error(`[AI ASSISTANT] Batch ${Math.floor(i/batchSize) + 1} translation error:`, batchError);
          retryCount++;
        }
      }

      if (!batchTranslated) {
        logger.error(`[AI ASSISTANT] Batch ${Math.floor(i/batchSize) + 1} failed after ${maxRetries} retries`);
        const fallbackItems = batch.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          description: item.description || ""
        }));
        translatedItems.push(...fallbackItems);
      }
    }

    if (translatedItems.length !== originalItemCount) {
      throw new AIAssistantError(
        `Translation failed: Item count mismatch. Expected ${originalItemCount} items, got ${translatedItems.length}`,
        "EXECUTION_FAILED"
      );
    }

    logger.debug(`[AI ASSISTANT] Updating ${translatedItems.length} translated items in database`);
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const translatedItem of translatedItems) {
      if (!translatedItem || !translatedItem.id || !translatedItem.name) {
        failedCount++;
        continue;
      }

      const updateData: unknown = {
        name: translatedItem.name,
        updated_at: new Date().toISOString()
      };
      
      if (translatedItem.category) {
        updateData.category = translatedItem.category;
      }
      
      if (params.includeDescriptions && translatedItem.description) {
        updateData.description = translatedItem.description;
      }

      const { error } = await supabase
        .from("menu_items")
        .update(updateData)
        .eq("id", translatedItem.id)
        .eq("venue_id", venueId);

      if (!error) {
        updatedCount++;
      } else {
        failedCount++;
      }
    }

    logger.debug(`[AI ASSISTANT] Translation complete: ${updatedCount} updated, ${failedCount} failed`);

    if (updatedCount === 0 && translatedItems.length > 0) {
      throw new AIAssistantError(
        `Translation failed: Could not update unknown items (${failedCount} failed)`,
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
  } catch (error) {
    logger.error("[AI ASSISTANT] Translation error:", error);
    throw new AIAssistantError(
      `Translation failed: ${error.message}`,
      "EXECUTION_FAILED",
      error
    );
  }
}

