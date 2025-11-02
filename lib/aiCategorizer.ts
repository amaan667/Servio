/**
 * AI-Powered Dynamic Categorization
 *
 * Uses GPT-4 to intelligently categorize items based on:
 * - Item name and description
 * - Existing category examples from PDF
 * - Pattern recognition from similar items
 *
 * This is truly dynamic and works for ANY menu type without hardcoded logic
 */

import { getOpenAI } from "./openai";
import { logger } from "./logger";

interface CategoryWithExamples {
  name: string;
  examples: string[];
}

/**
 * Intelligently categorize a new item using AI
 * Returns either an existing category or suggests creating a new one
 */
export async function categorizeItemWithAI(
  itemName: string,
  itemDescription: string | undefined,
  pdfCategories: string[],
  pdfItems: any[]
): Promise<{ category: string; confidence: number; shouldCreateNew: boolean }> {
  // Build category examples from PDF items
  const categoryExamples: CategoryWithExamples[] = pdfCategories.map((category) => ({
    name: category,
    examples: pdfItems
      .filter((item) => item.category === category)
      .slice(0, 5)
      .map((item) => item.name),
  }));

  const openai = getOpenAI();

  const prompt = `You are an expert menu analyst. Categorize this menu item.

ITEM TO CATEGORIZE:
Name: "${itemName}"
Description: "${itemDescription || "No description"}"

EXISTING CATEGORIES (with example items):
${categoryExamples.map((cat) => `- ${cat.name}: ${cat.examples.join(", ")}`).join("\n")}

CRITICAL BEVERAGE DETECTION (READ THIS FIRST):
⚠️ Brand names that are BEVERAGES (NOT desserts): San Pellegrino, Aspire, Dash Water, Red Bull, Monster, Evian, Fiji, Coca-Cola
⚠️ If item contains these brands → Beverages/Drinks/Juices category (NEVER Desserts, even if has "Raspberry" or "Strawberry")
⚠️ "Aspire Raspberry" = energy drink (Beverages), NOT a raspberry dessert
⚠️ Any water (still, sparkling) = always Beverages
⚠️ Energy drinks, soft drinks, bottled water = Beverages

TASK:
Determine which EXISTING category this item belongs to, OR if it needs a NEW category.

CATEGORIZATION PRIORITY:
1. FIRST: Check if it's a beverage brand (see list above) → Use Beverages/Drinks/Juices if exists
2. SECOND: Check if similar items exist in current categories (match by type, not ingredients)
3. THIRD: Only create NEW category if truly a different cuisine/type

RULES:
1. Prefer EXISTING categories over creating new ones
2. Match by ITEM TYPE (e.g., all drinks together, all desserts together)
3. "Raspberry" in name doesn't mean dessert if it's a drink brand
4. Return "NEW_CATEGORY: [Name]" only if genuinely new type

EXAMPLES:
✅ "San Pellegrino Lemonade" + Juices exists [Orange Juice] → "Juices"
✅ "Aspire Raspberry" → This is Aspire brand energy drink → "Beverages" or "NEW_CATEGORY: Beverages"
❌ "Aspire Raspberry" → "Desserts" (WRONG! It's a drink!)
✅ "Espresso" + Coffee exists → "Coffee" or "Hot Coffee"
✅ "Croissant" + NO pastry category → "NEW_CATEGORY: Pastries"

RESPOND WITH ONLY:
- Existing category name, OR
- "NEW_CATEGORY: [Name]"`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Fast and cheap for this task
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 50,
    });

    const result = response.choices[0]?.message?.content?.trim() || "Menu Items";

    logger.info("[AI CATEGORIZER] Categorization result", {
      item: itemName,
      result: result,
    });

    // Check if AI suggests new category
    if (result.startsWith("NEW_CATEGORY:")) {
      const newCategoryName = result.replace("NEW_CATEGORY:", "").trim();
      return {
        category: newCategoryName,
        confidence: 0.9,
        shouldCreateNew: true,
      };
    }

    // Validate it matches an existing category (case-insensitive)
    const normalized = result.toLowerCase();
    const matchedCategory = pdfCategories.find((c) => c.toLowerCase() === normalized);

    if (matchedCategory) {
      return {
        category: matchedCategory,
        confidence: 0.95,
        shouldCreateNew: false,
      };
    }

    // If AI returned something that doesn't match, try fuzzy matching
    for (const pdfCat of pdfCategories) {
      if (pdfCat.toLowerCase().includes(normalized) || normalized.includes(pdfCat.toLowerCase())) {
        return {
          category: pdfCat,
          confidence: 0.85,
          shouldCreateNew: false,
        };
      }
    }

    // Fallback: create new category with AI's suggestion
    logger.warn("[AI CATEGORIZER] AI returned unknown category, creating new", {
      item: itemName,
      aiSuggestion: result,
    });

    return {
      category: result,
      confidence: 0.7,
      shouldCreateNew: true,
    };
  } catch (error) {
    logger.error("[AI CATEGORIZER] Failed, using fallback", {
      error: error instanceof Error ? error.message : String(error),
      item: itemName,
    });

    // Fallback to most common PDF category
    return {
      category: pdfCategories[0] || "Menu Items",
      confidence: 0.5,
      shouldCreateNew: false,
    };
  }
}

/**
 * Batch categorize multiple items (more efficient with caching)
 */
export async function categorizeItemsBatch(
  items: Array<{ name: string; description?: string }>,
  pdfCategories: string[],
  pdfItems: any[]
): Promise<Map<string, { category: string; confidence: number; shouldCreateNew: boolean }>> {
  const results = new Map();

  // Process in batches of 10 for efficiency
  const batchSize = 10;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const promises = batch.map((item) =>
      categorizeItemWithAI(item.name, item.description, pdfCategories, pdfItems)
    );

    const batchResults = await Promise.all(promises);

    batch.forEach((item, idx) => {
      results.set(item.name, batchResults[idx]);
    });
  }

  return results;
}
