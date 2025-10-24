
import { getOpenAI } from "./openai";
import fs from "fs";
import { logger } from '@/lib/logger';

export async function extractMenuFromImage(imagePath: string) {
  const openai = getOpenAI();
  const imageBytes = fs.readFileSync(imagePath).toString("base64");

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
              url: `data:image/png;base64,${imageBytes}`,
            },
          },
        ],
      },
    ],
    temperature: 0.2,
  });

  const text = response.choices[0]?.message?.content;
  try {
    const json = JSON.parse(text!);
    return json;
  } catch (err) {
    logger.error("Failed to parse JSON:", text);
    throw new Error("Invalid JSON response from GPT Vision");
  }
}

/**
 * Extract menu item positions from PDF image for hotspot creation
 * Used by hybrid import to create perfectly positioned add-to-cart buttons
 */
export async function extractMenuItemPositions(imageUrl: string) {
  const openai = getOpenAI();

  const prompt = `
Analyze this menu page and extract the exact position of each menu item.

For each item, provide:
1. Item name (exact text from menu)
2. X coordinate (0-100, where 0 is left edge, 100 is right edge)
3. Y coordinate (0-100, where 0 is top, 100 is bottom)
4. Confidence score (0-1)

Return as JSON array:
[
  {"name": "Item Name", "x": 25, "y": 30, "confidence": 0.95},
  ...
]

IMPORTANT:
- Measure X,Y from where you would place an "add to cart" button for that item
- For items in left column, X should be around 20-40
- For items in right column, X should be around 60-80
- Y should be the vertical position of the item text
- Be precise - these coordinates will be used for clickable buttons
- If bilingual, use the English name
- Only include actual menu items with prices, not headers/titles
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
    const json = JSON.parse(jsonMatch[0]);
    return json;
  } catch (err) {
    logger.error("Failed to parse menu positions JSON:", text);
    throw new Error("Invalid JSON response from GPT Vision for positions");
  }
}
