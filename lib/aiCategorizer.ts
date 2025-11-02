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

TASK:
Determine which existing category this item belongs to, OR if it needs a new category.

RULES:
1. If the item clearly fits an existing category (same type of food/drink), return that category name
2. If the item is a NEW type not represented in existing categories, return "NEW_CATEGORY: [suggested name]"
3. Examples:
   - "San Pellegrino Lemonade" → If "Drinks/Beverages/Juices" exists, use that
   - "San Pellegrino Lemonade" → If no drink category exists, return "NEW_CATEGORY: Beverages"
   - "Espresso" → "Coffee" (if Coffee category exists)
   - "Sushi Roll" → "NEW_CATEGORY: Sushi" (if only pizza/burgers exist)

RESPOND WITH ONLY:
- Category name (if matches existing), OR
- "NEW_CATEGORY: [Name]" (if new type needed)`;

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
