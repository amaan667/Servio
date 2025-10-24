
import { getOpenAI } from "./openai";
import fs from "fs";
import { logger } from '@/lib/logger';

export async function extractMenuFromImage(imagePathOrDataUrl: string) {
  const openai = getOpenAI();
  
  // Handle both file paths and data URLs
  let imageUrl: string;
  if (imagePathOrDataUrl.startsWith('data:')) {
    // Already a data URL
    imageUrl = imagePathOrDataUrl;
  } else if (imagePathOrDataUrl.startsWith('http')) {
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
    "category": "Starters"
  },
  ...
]

Rules:
- Include all items that have names and prices.
- Use the English translation if bilingual.
- Group items under reasonable categories.
- Add-ons should be included with "Add-on" in the name.
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
              detail: 'high',
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
    // Extract JSON from response (might be wrapped in markdown)
    const jsonMatch = text?.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    const json = JSON.parse(jsonMatch[0]);
    return json;
  } catch (err) {
    logger.error("Failed to parse JSON:", text);
    throw new Error("Invalid JSON response from GPT Vision");
  }
}

/**
 * Extract menu item bounding boxes from PDF image for overlay cards
 * Returns full rectangles for each item, not just center points
 */
export async function extractMenuItemPositions(imageUrl: string) {
  const openai = getOpenAI();

  const prompt = `
Analyze this menu page and extract the bounding box for each menu item.

For each item that has a name AND price, provide:
1. Item name (exact text from menu)
2. Bounding box coordinates as percentages (0-100):
   - x1: left edge of the item
   - y1: top edge of the item
   - x2: right edge of the item (where price ends)
   - y2: bottom edge of the item
3. Confidence score (0-1)

Return as JSON array:
[
  {
    "name": "Item Name",
    "x1": 10,
    "y1": 25,
    "x2": 90,
    "y2": 32,
    "confidence": 0.95
  },
  ...
]

CRITICAL RULES:
- Include ONLY actual menu items with prices (not section headers, not "ADD ONS" titles)
- Bounding box should encompass the entire item: name + description + price
- For multi-column layouts, x1 should be the actual left edge of that column
- y1 and y2 should tightly wrap the item (no large gaps)
- If bilingual, use the English name
- Be very precise with the boundaries
- Confidence should reflect how certain you are about the item boundaries
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
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0.1, // Low temperature for precise coordinates
  });

  const text = response.choices[0]?.message?.content;
  try {
    // Extract JSON from response (might be wrapped in markdown)
    const jsonMatch = text?.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    const positions = JSON.parse(jsonMatch[0]);
    
    // Convert bounding box format to include both center point (for backward compatibility)
    // and full bounding box for overlay cards
    return positions.map((pos: any) => ({
      name: pos.name,
      // Keep legacy x,y as center point for backward compatibility
      x: pos.x1 && pos.x2 ? (pos.x1 + pos.x2) / 2 : pos.x || 50,
      y: pos.y1 && pos.y2 ? (pos.y1 + pos.y2) / 2 : pos.y || 50,
      // Add bounding box coordinates
      x1: pos.x1 || pos.x - 5,
      y1: pos.y1 || pos.y - 3,
      x2: pos.x2 || pos.x + 5,
      y2: pos.y2 || pos.y + 3,
      confidence: pos.confidence || 0.8,
    }));
  } catch (err) {
    logger.error("Failed to parse menu positions JSON:", text);
    throw new Error("Invalid JSON response from GPT Vision for positions");
  }
}
