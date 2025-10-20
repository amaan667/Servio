// AI Assistant Undo API
// Handles undoing AI assistant actions

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { z } from "zod";
import { apiLogger, logger } from '@/lib/logger';

const UndoRequestSchema = z.object({
  venueId: z.string().min(1),
  messageId: z.string().uuid(),
  undoData: z.object({
    toolName: z.string(),
    params: z.unknown(),
    result: z.unknown(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { venueId, messageId, undoData } = UndoRequestSchema.parse(body);

    // Verify user has access to venue
    const { data: venue } = await supabase
      .from("venues")
      .select("owner_id")
      .eq("venue_id", venueId)
      .single();

    if (!venue || venue.owner_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied to this venue" },
        { status: 403 }
      );
    }

    // Get the message to undo
    const { data: message } = await supabase
      .from("ai_chat_messages")
      .select(`
        *,
        ai_chat_conversations!inner(
          venue_id,
          user_id
        )
      `)
      .eq("id", messageId)
      .single();

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    if (!message.can_undo) {
      return NextResponse.json(
        { error: "This action cannot be undone" },
        { status: 400 }
      );
    }

    // Verify user has access to this message
    if (message.ai_chat_conversations.user_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied to this message" },
        { status: 403 }
      );
    }

    // Execute undo based on tool type
    let undoResult;
    
    switch (undoData.toolName) {
      case "menu.translate":
        undoResult = await undoMenuTranslation(venueId, undoData, supabase);
        break;
        
      case "menu.update_prices":
        undoResult = await undoMenuPriceUpdate(venueId, undoData, supabase);
        break;
        
      case "menu.toggle_availability":
        undoResult = await undoMenuAvailabilityToggle(venueId, undoData, supabase);
        break;
        
      case "menu.create_item":
        undoResult = await undoMenuItemCreation(venueId, undoData, supabase);
        break;
        
      case "menu.delete_item":
        undoResult = await undoMenuItemDeletion(venueId, undoData, supabase);
        break;
        
      case "inventory.adjust_stock":
        undoResult = await undoInventoryAdjustment(venueId, undoData, supabase);
        break;
        
      default:
        return NextResponse.json(
          { error: `Undo not supported for tool: ${undoData.toolName}` },
          { status: 400 }
        );
    }

    if (!undoResult.success) {
      return NextResponse.json(
        { error: undoResult.error || "Undo failed" },
        { status: 500 }
      );
    }

    // Record the undo action
    const { error: undoRecordError } = await supabase
      .from("ai_undo_actions")
      .insert({
        message_id: messageId,
        undo_type: undoData.toolName,
        undo_params: undoData,
        executed_by: user.id,
      });

    if (undoRecordError) {
      logger.error("[AI UNDO] Failed to record undo action:", undoRecordError);
    }

    // Mark the original message as no longer undoable
    await supabase
      .from("ai_chat_messages")
      .update({ can_undo: false })
      .eq("id", messageId);

    return NextResponse.json({
      success: true,
      message: "Action successfully undone",
      undoResult,
    });
  } catch (error: unknown) {
    logger.error("[AI UNDO] Undo error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Undo failed" },
      { status: 500 }
    );
  }
}

// Undo handlers for different tool types
async function undoMenuTranslation(venueId: string, undoData: unknown, supabase: unknown) {
  try {
    // For translation, we need to translate back to the original language
    // This is complex because we need to know what the original language was
    // For now, we'll implement a simple approach: translate back to Spanish if target was English
    
    const targetLanguage = undoData.params.targetLanguage;
    const reverseLanguage = targetLanguage === "en" ? "es" : "en";
    
    // Get current menu items
    const { data: items } = await supabase
      .from("menu_items")
      .select("id, name, description, category")
      .eq("venue_id", venueId);

    if (!items || items.length === 0) {
      return { success: false, error: "No menu items found" };
    }

    // Import OpenAI for reverse translation
    const { getOpenAI } = await import("@/lib/openai");
    const openai = getOpenAI();

    const languageNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
    };

    // Comprehensive bidirectional category mappings
    const categoryMappings = {
      en: {
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
        "TEA": "TÉ",
        "SPECIALS": "ESPECIALES",
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
      es: {
        "ENTRADAS": "STARTERS",
        "APERITIVOS": "APPETIZERS",
        "PLATOS PRINCIPALES": "MAIN COURSES",
        "POSTRES": "DESSERTS",
        "ENSALADAS": "SALADS",
        "NIÑOS": "KIDS",
        "BEBIDAS": "DRINKS",
        "CAFÉ": "COFFEE",
        "CAFE": "COFFEE",
        "TÉ": "TEA",
        "TE": "TEA",
        "ESPECIALES": "SPECIALS",
        "SÁNDWICHES": "SANDWICHES",
        "SANDWICHES": "SANDWICHES",
        "MALTEADAS": "MILKSHAKES",
        "BATIDOS": "SHAKES",
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

    const targetLangName = languageNames[reverseLanguage] || reverseLanguage;

    // Detect the source language by analyzing the current categories
    const detectSourceLanguage = (items: unknown[]): string => {
      const categories = items.map(item => item.category).filter(Boolean);
      const spanishIndicators = ['CAFÉ', 'BEBIDAS', 'TÉ', 'ESPECIALES', 'NIÑOS', 'ENSALADAS', 'POSTRES', 'ENTRADAS', 'PLATOS PRINCIPALES', 'APERITIVOS', 'MALTEADAS', 'BATIDOS', 'SÁNDWICHES', 'DESAYUNO', 'ALMUERZO', 'CENA', 'SOPA', 'SOPAS', 'MARISCOS', 'POLLO', 'CARNE DE RES', 'CERDO', 'VEGETARIANO', 'VEGANO', 'SIN GLUTEN'];
      const englishIndicators = ['STARTERS', 'APPETIZERS', 'MAIN COURSES', 'ENTREES', 'DESSERTS', 'SALADS', 'KIDS', 'CHILDREN', 'DRINKS', 'BEVERAGES', 'COFFEE', 'TEA', 'SPECIALS', 'WRAPS', 'SANDWICHES', 'MILKSHAKES', 'SHAKES', 'SMOOTHIES', 'BRUNCH', 'BREAKFAST', 'LUNCH', 'DINNER', 'SOUP', 'SOUPS', 'PASTA', 'PIZZA', 'SEAFOOD', 'CHICKEN', 'BEEF', 'PORK', 'VEGETARIAN', 'VEGAN', 'GLUTEN FREE'];
      
      let spanishCount = 0;
      let englishCount = 0;
      
      categories.forEach(category => {
        if (spanishIndicators.some(indicator => category.toUpperCase().includes(indicator))) {
          spanishCount++;
        }
        if (englishIndicators.some(indicator => category.toUpperCase().includes(indicator))) {
          englishCount++;
        }
      });
      
      logger.debug(`[AI UNDO] Language detection: ${spanishCount} Spanish indicators, ${englishCount} English indicators`);
      
      // If we have more Spanish indicators, assume source is Spanish
      if (spanishCount > englishCount) {
        logger.debug(`[AI UNDO] Detected source language: Spanish`);
        return 'es';
      } else if (englishCount > spanishCount) {
        logger.debug(`[AI UNDO] Detected source language: English`);
        return 'en';
      } else {
        // If equal or no clear indicators, use the reverse language
        logger.debug(`[AI UNDO] Ambiguous language, using reverse: ${reverseLanguage}`);
        return reverseLanguage;
      }
    };

    const detectedSourceLanguage = detectSourceLanguage(items);

    // Translate items back
    const batchSize = 15;
    const translatedItems: unknown[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const itemsToTranslate = batch.map((item: unknown) => ({
        id: item.id,
        name: item.name,
        category: item.category,
      }));

      // Generate comprehensive category mapping instructions for undo
      const categoryMappingList = Object.entries((categoryMappings as unknown)[detectedSourceLanguage] || {})
        .map(([from, to]) => `   - "${from}" → "${to}"`)
        .join('\n');

      const prompt = `Translate ALL menu items from ${detectedSourceLanguage.toUpperCase()} back to ${targetLangName}. 
Return a JSON object with an "items" array containing the translated items.
Keep the 'id' field unchanged. Maintain culinary context and use natural translations.

CRITICAL REQUIREMENTS:
1. You MUST return EXACTLY ${batch.length} items (same count as input)
2. You MUST translate EVERY SINGLE item name and category name back to ${targetLangName}
3. Each item must have the same 'id' field as the input
4. Do NOT skip unknown items - translate ALL of them
5. For category translation, use these mappings:
${categoryMappingList}
6. If a category is not in the mapping list, translate it naturally to ${targetLangName}
7. DETECTED SOURCE LANGUAGE: ${detectedSourceLanguage.toUpperCase()}

Items to translate back (translate ALL of these):
${JSON.stringify(itemsToTranslate, null, 2)}

Return format: {"items": [{"id": "...", "name": "translated name", "category": "translated category"}]}

IMPORTANT: Every item in the input must appear in your output with a translated name and category.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-2024-08-06",
        messages: [
          {
            role: "system",
            content: `You are a professional menu translator. Return valid JSON with an 'items' array containing EXACTLY ${batch.length} items.`
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
        
        // Validate that we got the expected number of items and all have required fields
        if (translatedArray.length === batch.length) {
          // Additional validation: check that all items have required fields
          const validItems = translatedArray.filter((item: unknown) => 
            item && item.id && item.name && item.category
          );
          
          if (validItems.length === batch.length) {
            logger.debug(`[AI UNDO] Batch translation successful: ${translatedArray.length} items`);
            translatedItems.push(...translatedArray);
          } else {
            logger.warn(`[AI UNDO] Batch has ${validItems.length} valid items, expected ${batch.length}`);
            // Still add the valid items to avoid losing translations
            translatedItems.push(...validItems);
          }
        } else {
          logger.warn(`[AI UNDO] Batch translation returned ${translatedArray.length} items, expected ${batch.length}`);
          // Still add what we got to avoid losing translations
          translatedItems.push(...translatedArray);
        }
      } else {
        logger.error("[AI UNDO] No content in translation response");
      }
    }

    // Update database with reverse translations
    let updatedCount = 0;
    const translatedIds = new Set(translatedItems.map(item => item.id));
    
    for (const translatedItem of translatedItems) {
      if (!translatedItem || !translatedItem.id || !translatedItem.name) {
        continue;
      }

      const { error } = await supabase
        .from("menu_items")
        .update({
          name: translatedItem.name,
          category: translatedItem.category,
          updated_at: new Date().toISOString()
        })
        .eq("id", translatedItem.id)
        .eq("venue_id", venueId);

      if (!error) {
        updatedCount++;
      }
    }

    // Check for unknown items that weren't translated
    const missingItems = items.filter((item: unknown) => !translatedIds.has(item.id));
    if (missingItems.length > 0) {
      logger.warn(`[AI UNDO] ${missingItems.length} items were not translated:`, missingItems.map((item: unknown) => item.name));
    }

    return {
      success: true,
      message: `Successfully reversed translation: ${updatedCount} items translated back to ${targetLangName}`,
      itemsUpdated: updatedCount,
    };
  } catch (error: unknown) {
    logger.error("[AI UNDO] Menu translation undo error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: error.message };
  }
}

async function undoMenuPriceUpdate(venueId: string, undoData: unknown, supabase: unknown) {
  try {
    // For price updates, we need to restore original prices
    // The undoData should contain the original prices from the execution result
    
    const originalPrices = undoData.result.originalPrices || [];
    let updatedCount = 0;

    for (const priceUpdate of originalPrices) {
      const { error } = await supabase
        .from("menu_items")
        .update({
          price: priceUpdate.originalPrice,
          updated_at: new Date().toISOString()
        })
        .eq("id", priceUpdate.id)
        .eq("venue_id", venueId);

      if (!error) {
        updatedCount++;
      }
    }

    return {
      success: true,
      message: `Successfully restored original prices for ${updatedCount} items`,
      itemsUpdated: updatedCount,
    };
  } catch (error: unknown) {
    logger.error("[AI UNDO] Menu price update undo error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: error.message };
  }
}

async function undoMenuAvailabilityToggle(venueId: string, undoData: unknown, supabase: unknown) {
  try {
    // For availability toggle, we need to restore original availability
    const originalAvailability = undoData.params.available;
    const newAvailability = !originalAvailability;

    const { error } = await supabase
      .from("menu_items")
      .update({
        available: newAvailability,
        updated_at: new Date().toISOString()
      })
      .in("id", undoData.params.itemIds)
      .eq("venue_id", venueId);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `Successfully restored availability for ${undoData.params.itemIds.length} items`,
      itemsUpdated: undoData.params.itemIds.length,
    };
  } catch (error: unknown) {
    logger.error("[AI UNDO] Menu availability toggle undo error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: error.message };
  }
}

async function undoMenuItemCreation(venueId: string, undoData: unknown, supabase: unknown) {
  try {
    // For item creation, we need to delete the created item
    const createdItemId = undoData.result.id;

    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", createdItemId)
      .eq("venue_id", venueId);

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `Successfully deleted created item: ${undoData.result.name}`,
      itemsDeleted: 1,
    };
  } catch (error: unknown) {
    logger.error("[AI UNDO] Menu item creation undo error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: error.message };
  }
}

async function undoMenuItemDeletion(venueId: string, undoData: unknown, supabase: unknown) {
  try {
    // For item deletion, we need to recreate the deleted item
    const deletedItem = undoData.result.deletedItem;

    const { data: recreatedItem, error } = await supabase
      .from("menu_items")
      .insert({
        venue_id: venueId,
        name: deletedItem.name,
        description: deletedItem.description,
        price: deletedItem.price,
        category: deletedItem.category,
        available: deletedItem.available,
        created_at: deletedItem.created_at,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      message: `Successfully recreated deleted item: ${deletedItem.name}`,
      itemsRecreated: 1,
    };
  } catch (error: unknown) {
    logger.error("[AI UNDO] Menu item deletion undo error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: error.message };
  }
}

async function undoInventoryAdjustment(venueId: string, undoData: unknown, supabase: unknown) {
  try {
    // For inventory adjustments, we need to reverse the stock changes
    const adjustments = undoData.params.adjustments;
    let updatedCount = 0;

    for (const adjustment of adjustments) {
      // Reverse the delta (multiply by -1)
      const reverseDelta = -adjustment.delta;

      const { error } = await supabase.rpc("adjust_stock", {
        p_ingredient_id: adjustment.ingredientId,
        p_delta: reverseDelta,
      });

      if (!error) {
        updatedCount++;
      }
    }

    return {
      success: true,
      message: `Successfully reversed inventory adjustments for ${updatedCount} ingredients`,
      ingredientsUpdated: updatedCount,
    };
  } catch (error: unknown) {
    logger.error("[AI UNDO] Inventory adjustment undo error:", { error: error instanceof Error ? error.message : 'Unknown error' });
    return { success: false, error: error.message };
  }
}
