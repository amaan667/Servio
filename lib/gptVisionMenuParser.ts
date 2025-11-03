import { getOpenAI } from "./openai";
import fs from "fs";
import { logger } from "@/lib/logger";

export async function extractMenuFromImage(imagePathOrDataUrl: string) {
  const openai = getOpenAI();

  // Handle both file paths and data URLs
  let imageUrl: string;
  if (imagePathOrDataUrl.startsWith("data:")) {
    // Already a data URL
    imageUrl = imagePathOrDataUrl;
  } else if (imagePathOrDataUrl.startsWith("http")) {
    // HTTP URL
    imageUrl = imagePathOrDataUrl;
  } else {
    // File path - read and convert to base64
    const imageBytes = fs.readFileSync(imagePathOrDataUrl).toString("base64");
    imageUrl = `data:image/png;base64,${imageBytes}`;
  }

  const prompt = `
You are an expert at reading venue menus. 
From the image, extract structured JSON in the following format:

[
  {
    "name": "Dish Name",
    "description": "Optional description",
    "price": 12.50,
    "category": "Starters",
    "allergens": ["nuts", "dairy", "gluten"],
    "dietary": ["vegetarian", "vegan", "gluten-free"],
    "spiceLevel": "mild"
  },
  ...
]

CRITICAL RULES FOR CATEGORIES:
1. SECTION HEADERS are categories:
   - A CATEGORY is a SECTION HEADER on the menu (like "Starters", "Mains", "Desserts", "Hot Drinks", "Coffee", "All Day Brunch")
   - Look for larger text, bold headers, or section dividers that group multiple items together
- If you see "BREAKFAST" heading with items below it, those items belong to category "Breakfast"
- If you see "COFFEE" heading with "Espresso", "Latte", etc. below, they all belong to category "Coffee"

2. CONTINUATION SECTIONS (items without a new header):
   - If items appear AFTER a category section but BEFORE the next category header, they likely belong to the PREVIOUS category
   - Example: If you see "ALL DAY BRUNCH" followed by items like "Matcha Bowl", "Granola", then more items like "Shakshuka", "Turkish Eggs", "Waffles" WITHOUT a new header before "KIDS" section, those items still belong to "All Day Brunch"
   - Use visual spacing and layout to determine if items are part of the previous section

3. INTELLIGENT CATEGORIZATION:
   - Breakfast/brunch items include: eggs, pancakes, waffles, french toast, shakshuka, granola, yogurt bowls, breakfast platters, turkish eggs
   - Coffee/tea items include: espresso, latte, cappuccino, americano, mocha, tea varieties
   - Desserts include: cakes, pastries, sweet items
   - ONLY use "Menu Items" as a LAST RESORT if the item truly doesn't fit any existing category

4. DO NOT use item names as categories:
   - "Croissant", "Latte", "Burger" are NOT categories - they are items
   - A category groups MULTIPLE items together

ALLERGEN & DIETARY EXTRACTION RULES:
1. ALLERGENS (look for symbols, icons, or text):
   - Common allergens: "nuts", "peanuts", "tree nuts", "dairy", "milk", "eggs", "fish", "shellfish", "soy", "wheat", "gluten", "sesame", "celery", "mustard", "sulphites", "lupin", "molluscs"
   - Look for allergen symbols (V, VG, GF, DF, N, etc.)
   - Check item descriptions for allergen mentions
   - If no allergens mentioned, return empty array []

2. DIETARY INFORMATION (look for symbols or descriptions):
   - Common dietary tags: "vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free", "halal", "kosher", "keto", "paleo", "low-carb", "pescatarian"
   - Look for standard symbols: V = vegetarian, VG/VE = vegan, GF = gluten-free, DF = dairy-free
   - If item contains meat/fish, don't mark as vegetarian
   - If no dietary info mentioned, return empty array []

3. SPICE LEVEL (if indicated):
   - Look for chili symbols 🌶️ or text like "mild", "medium", "hot", "spicy", "extra hot"
   - If 1 chili: "mild"
   - If 2 chilies: "medium"
   - If 3+ chilies: "hot"
   - If no spice indication, omit this field entirely (don't include null)

OTHER RULES:
- Include all items that have names and prices.
- Use the English translation if bilingual.
- Add-ons should be included with "Add-on" in the name.
- Preserve the exact category names as they appear in the menu headers.
- IMPORTANT: allergens, dietary, and spiceLevel are OPTIONAL - only include if clearly indicated on menu.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0.2,
  });

  const text = response.choices[0]?.message?.content;
  try {
    if (!text) {
      throw new Error("No response from Vision AI");
    }

    logger.info("[VISION] Item extraction response length:", { length: text.length });

    // Extract JSON from response (might be wrapped in markdown like ```json [...] ```)
    let jsonText = text;

    // Remove markdown code blocks if present
    if (text.includes("```json")) {
      jsonText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    } else if (text.includes("```")) {
      jsonText = text.replace(/```\s*/g, "");
    }

    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error("[VISION] No JSON array found in item extraction response:", text);
      return [];
    }
    const json = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(json)) {
      logger.error("[VISION] Parsed data is not an array:", json);
      return [];
    }

    logger.info("[VISION PDF] ===== EXTRACTION COMPLETE =====");
    logger.info("[VISION PDF] Total items extracted:", { count: json.length });

    // Log categories for debugging
    const categories = Array.from(new Set(json.map((item: any) => item.category).filter(Boolean)));
    logger.info("[VISION PDF] Categories extracted:", {
      count: categories.length,
      categories: categories,
    });

    // Log detailed breakdown by category
    const categoryBreakdown: Record<string, number> = {};
    json.forEach((item: any) => {
      const cat = item.category || "Uncategorized";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    });

    logger.info("[VISION PDF] Category breakdown:", categoryBreakdown);

    // Log sample items from each category
    const samplesByCategory: Record<string, any[]> = {};
    json.forEach((item: any) => {
      const cat = item.category || "Uncategorized";
      if (!samplesByCategory[cat]) {
        samplesByCategory[cat] = [];
      }
      if (samplesByCategory[cat].length < 3) {
        samplesByCategory[cat].push({
          name: item.name,
          price: item.price,
          hasDescription: !!item.description,
        });
      }
    });

    logger.info("[VISION PDF] Sample items by category:", samplesByCategory);

    // Log any items with potential issues
    const itemsWithoutName = json.filter((item: any) => !item.name);
    const itemsWithoutPrice = json.filter((item: any) => !item.price && item.price !== 0);
    const itemsWithoutCategory = json.filter((item: any) => !item.category);

    if (itemsWithoutName.length > 0) {
      logger.warn("[VISION PDF] Items without name:", { count: itemsWithoutName.length });
    }
    if (itemsWithoutPrice.length > 0) {
      logger.warn("[VISION PDF] Items without price:", {
        count: itemsWithoutPrice.length,
        examples: itemsWithoutPrice.slice(0, 5).map((i: any) => i.name),
      });
    }
    if (itemsWithoutCategory.length > 0) {
      logger.warn("[VISION PDF] Items without category:", {
        count: itemsWithoutCategory.length,
        examples: itemsWithoutCategory.slice(0, 5).map((i: any) => i.name),
      });
    }

    // Log allergen and dietary information extraction
    const itemsWithAllergens = json.filter(
      (item: any) => item.allergens && item.allergens.length > 0
    );
    const itemsWithDietary = json.filter((item: any) => item.dietary && item.dietary.length > 0);
    const itemsWithSpiceLevel = json.filter((item: any) => item.spiceLevel);

    if (itemsWithAllergens.length > 0) {
      logger.info("[VISION PDF] 🥜 Allergen information extracted", {
        count: itemsWithAllergens.length,
        examples: itemsWithAllergens.slice(0, 3).map((i: any) => ({
          name: i.name,
          allergens: i.allergens,
        })),
      });
    }

    if (itemsWithDietary.length > 0) {
      logger.info("[VISION PDF] 🌱 Dietary information extracted", {
        count: itemsWithDietary.length,
        examples: itemsWithDietary.slice(0, 3).map((i: any) => ({
          name: i.name,
          dietary: i.dietary,
        })),
      });
    }

    if (itemsWithSpiceLevel.length > 0) {
      logger.info("[VISION PDF] 🌶️ Spice level information extracted", {
        count: itemsWithSpiceLevel.length,
        examples: itemsWithSpiceLevel.slice(0, 3).map((i: any) => ({
          name: i.name,
          spiceLevel: i.spiceLevel,
        })),
      });
    }

    logger.info("[VISION PDF] ===== EXTRACTION SUMMARY =====", {
      totalItems: json.length,
      totalCategories: categories.length,
      itemsComplete: json.filter((i: any) => i.name && i.price && i.category).length,
      itemsPartial: json.filter((i: any) => !i.name || !i.price || !i.category).length,
    });

    return json;
  } catch (_err) {
    logger.error("Failed to parse item extraction JSON:", text);
    logger.error("Parse error details:", _err);
    return [];
  }
}
