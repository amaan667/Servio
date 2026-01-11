/**
 * AI-Powered Item Matching
 *
 * For stubborn cases where algorithmic matching fails,
 * use GPT-4 to determine if two menu items are the same
 */

import { getOpenAI } from "./openai";

export interface MatchableMenuItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  name_normalized?: string;
}

/**
 * Use AI to determine if two items are the same menu item
 * Returns confidence score (0-1) and reasoning
 */
export async function matchItemsWithAI(
  pdfItem: MatchableMenuItem,
  urlItem: MatchableMenuItem
): Promise<{ isSame: boolean; confidence: number; reasoning: string }> {
  const openai = getOpenAI();

  const prompt = `You are an expert at matching menu items from different sources.

ITEM 1 (from PDF):
Name: "${pdfItem.name}"
Description: "${pdfItem.description || "N/A"}"
Price: £${pdfItem.price || "N/A"}
Category: "${pdfItem.category || "N/A"}"

ITEM 2 (from Website):
Name: "${urlItem.name}"
Description: "${urlItem.description || "N/A"}"
Price: £${urlItem.price || "N/A"}
Category: "${urlItem.category || "N/A"}"

QUESTION: Are these the SAME menu item?

CONSIDER:
- Name variations: "Pain au Chocolat" = "Chocolate Croissant"
- Word order: "Chicken Shawarma Wrap" = "Shawarma Wrap Chicken"
- Abbreviations: "Black (Americano / Long Black)" = "Long Black"
- Descriptions: Similar ingredients/descriptions = likely same item
- Price: Similar price is strong evidence (within £2)
- Category: Same category is good evidence

RESPOND WITH JSON:
{
  "is_same": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Example responses:
{"is_same": true, "confidence": 0.95, "reasoning": "Same dish, name variation"}
{"is_same": false, "confidence": 0.9, "reasoning": "Different items, different prices"}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);

    return {
      isSame: result.is_same === true,
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning || "Unknown",
    };
  } catch (error) {

    // Fallback: conservative approach - don't match if unsure
    return {
      isSame: false,
      confidence: 0.5,
      reasoning: "AI matching failed, defaulting to no match",
    };
  }
}

/**
 * Batch match multiple items (more efficient)
 */
export async function batchMatchItemsWithAI(
  pdfItem: MatchableMenuItem,
  urlItems: MatchableMenuItem[]
): Promise<{ item: MatchableMenuItem; confidence: number } | null> {
  // If only a few items, check them all
  if (urlItems.length <= 5) {
    for (const urlItem of urlItems) {
      const result = await matchItemsWithAI(pdfItem, urlItem);
      if (result.isSame && result.confidence >= 0.8) {
        return { item: urlItem, confidence: result.confidence };
      }
    }
    return null;
  }

  // For many items, use parallel checking with price filtering
  const priceFiltered = urlItems.filter((u) => {
    if (!pdfItem.price || !u.price) return true;
    return Math.abs(pdfItem.price - u.price) <= 3.0;
  });

  for (const urlItem of priceFiltered.slice(0, 3)) {
    const result = await matchItemsWithAI(pdfItem, urlItem);
    if (result.isSame && result.confidence >= 0.8) {
      return { item: urlItem, confidence: result.confidence };
    }
  }

  return null;
}
