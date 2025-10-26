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

    logger.info("[VISION] Item extraction response length:", text.length);

    // Extract JSON from response (might be wrapped in markdown)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error("[VISION] No JSON array found in item extraction response:", text);
      return [];
    }
    const json = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(json)) {
      logger.error("[VISION] Parsed data is not an array:", json);
      return [];
    }

    logger.info("[VISION] Extracted items:", json.length);
    return json;
  } catch (_err) {
    logger.error("Failed to parse item extraction JSON:", text);
    logger.error("Parse error details:", _err);
    return [];
  }
}

/**
 * Extract menu item bounding boxes from PDF image for overlay cards
 * Returns full rectangles for each item, not just center points
 */
export async function extractMenuItemPositions(imageUrl: string) {
  const openai = getOpenAI();

  const prompt = `
You are analyzing a restaurant menu to place "Add to Cart" buttons.

TASK: For EACH menu item, identify where to place a small button (not a full overlay).

IMPORTANT LAYOUT DETECTION:
- If menu has 2 columns: left items span x: 0-50%, right items span x: 50-100%
- If menu has 1 column: items span x: 0-100%
- DO NOT create boxes that span more than one column (max width 45%)

For each menu item with a price, return:
{
  "name": "Item Name",
  "x1": 5,    // Left edge of item in its column
  "y1": 20,   // Top of item text
  "x2": 45,   // Right edge (price end) in its column  
  "y2": 25,   // Bottom of item
  "confidence": 0.95
}

EXAMPLES for 2-column menu:
Left column: "Labneh £8.00" → x1: 5, x2: 48, width: 43%
Right column: "Burger £12.00" → x1: 52, x2: 95, width: 43%

RULES:
1. EACH item = ONE box (not multiple items in one box!)
2. Width should be ~40-45% max (one column width)
3. Height should be ~3-8% (just that item's text height)
4. If box width > 50%, you're doing it WRONG
5. Include items from ALL columns
6. Skip section headers (STARTERS, MAINS, etc.)

Return ONLY the JSON array, no explanation.
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
    temperature: 0.1, // Low temperature for precise coordinates
  });

  const text = response.choices[0]?.message?.content;
  try {
    if (!text) {
      throw new Error("No response from Vision AI");
    }

    logger.info("[VISION] Raw response length:", text.length);
    logger.info("[VISION] First 200 chars:", text.substring(0, 200));

    // Extract JSON from response (might be wrapped in markdown or have explanation text)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error("[VISION] No JSON array found in response:", text);
      // Return empty array instead of crashing
      return [];
    }

    const positions = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(positions)) {
      logger.error("[VISION] Parsed data is not an array:", positions);
      return [];
    }

    logger.info("[VISION] Parsed positions:", positions.length);

    // Log first few positions for debugging

    // Validate positions
    positions.forEach((pos: any, index: number) => {
      if (!pos.name || !pos.x1 || !pos.y1 || !pos.x2 || !pos.y2) {
        /* Empty */
      }
      if (pos.x2 - pos.x1 > 50) {
        /* Empty */
      }
    });

    // Convert and validate bounding box coordinates
    return positions.map((pos: any) => {
      // Clamp values to valid range (0-100)
      const clamp = (val: number) => Math.max(0, Math.min(100, val));

      const x1 = clamp(pos.x1 !== undefined ? pos.x1 : (pos.x || 50) - 5);
      const y1 = clamp(pos.y1 !== undefined ? pos.y1 : (pos.y || 50) - 3);
      const x2 = clamp(pos.x2 !== undefined ? pos.x2 : (pos.x || 50) + 5);
      const y2 = clamp(pos.y2 !== undefined ? pos.y2 : (pos.y || 50) + 3);

      // Ensure x2 > x1 and y2 > y1
      const finalX2 = Math.max(x2, x1 + 1);
      const finalY2 = Math.max(y2, y1 + 1);

      return {
        name: pos.name || "Unknown Item",
        x: clamp((x1 + finalX2) / 2),
        y: clamp((y1 + finalY2) / 2),
        x1,
        y1,
        x2: finalX2,
        y2: finalY2,
        confidence: pos.confidence || 0.8,
      };
    });
  } catch (_err) {
    logger.error("Failed to parse menu positions JSON:", text);
    logger.error("Parse error details:", _err);
    // Return empty array instead of crashing - menu will still work without hotspots
    return [];
  }
}
