/**
 * AI-Powered Item Matching
 *
 * For stubborn cases where algorithmic matching fails,
 * use GPT-4 to determine if two menu items are the same
 */

import { getOpenAI } from "./openai";

export interface MatchableMenuItem {

}

/**
 * Use AI to determine if two items are the same menu item
 * Returns confidence score (0-1) and reasoning
 */
export async function matchItemsWithAI(

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

  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

Example responses:
{"is_same": true, "confidence": 0.95, "reasoning": "Same dish, name variation"}
{"is_same": false, "confidence": 0.9, "reasoning": "Different items, different prices"}`;

  try {
    const response = await openai.chat.completions.create({

      messages: [{ role: "user", content: prompt }],

      response_format: { type: "json_object" },

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);

    

    return {

    };
  } catch (error) {

    // Fallback: conservative approach - don't match if unsure
    return {

      reasoning: "AI matching failed, defaulting to no match",
    };
  }
}

/**
 * Batch match multiple items (more efficient)
 */
export async function batchMatchItemsWithAI(

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

  for (const urlItem of priceFiltered.slice(0, 3)) {
    const result = await matchItemsWithAI(pdfItem, urlItem);
    if (result.isSame && result.confidence >= 0.8) {
      return { item: urlItem, confidence: result.confidence };
    }
  }

  return null;
}
