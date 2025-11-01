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

    logger.info("[VISION] Extracted items:", { count: json.length });
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
You are analyzing a restaurant menu PDF to place "Add to Cart" buttons directly on each menu item.

TASK: For EACH menu item with a price, find where the item's name ends and price begins, then place a button hotspot there.

COORDINATE SYSTEM:
- All coordinates are percentages: 0-100%
- (0,0) = top-left of page, (100,100) = bottom-right
- Button should be placed at the RIGHT edge of each item row, vertically centered on the item

For each menu item, return:
{
  "name": "Exact Item Name as shown in menu",
  "name_normalized": "exact item name lowercase",  // Normalized for matching
  "x1": 8.5,   // Left edge where item name starts
  "y1": 22.3,  // Top of item (where name begins)
  "x2": 92.5,  // Right edge where price ends (button goes here)
  "y2": 26.8,  // Bottom of item (end of price)
  "button_x": 92.5,  // X position for button (right edge, near price)
  "button_y": 24.5,  // Y position for button (vertical center of item)
  "price": 12.50,  // Price amount to help with matching
  "confidence": 0.95
}

LAYOUT RULES:
- If 2 columns: Left column items x1: 5-47%, Right column items x1: 52-95%
- If 1 column: Items span x1: 5-10%, x2: 90-95%
- Button should be positioned at the RIGHT edge of the item (near the price)
- Button Y position should be the vertical MIDDLE of the item (average of y1 and y2)

CRITICAL:
1. Find EACH item individually - don't combine multiple items
2. Button position (button_x, button_y) should be where you'd naturally click to add that item
3. If price is on same line as name: button_x = x2 (right edge), button_y = (y1+y2)/2
4. If price is below name: button_x = right side, button_y = center of price line
5. Skip section headers, decorative text, descriptions without prices
6. Only items WITH prices get buttons

Return ONLY a JSON array, no markdown, no explanation.
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

    logger.info("[VISION] Raw response length:", { length: text.length });
    logger.info("[VISION] First 200 chars:", text.substring(0, 200));

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
      logger.error("[VISION] No JSON array found in response:", text);
      // Return empty array instead of crashing
      return [];
    }

    const positions = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(positions)) {
      logger.error("[VISION] Parsed data is not an array:", positions);
      return [];
    }

    logger.info("[VISION] Parsed positions:", { count: positions.length });

    // Log first few positions for debugging

    // Validate positions
    positions.forEach((pos: any, _index: number) => {
      if (!pos.name || !pos.x1 || !pos.y1 || !pos.x2 || !pos.y2) {
        /* Empty */
      }
      if (pos.x2 - pos.x1 > 50) {
        /* Empty */
      }
    });

    // Convert and validate bounding box coordinates with button positions
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

      // Button position: Use provided button_x/button_y, or calculate from bounding box
      const buttonX = clamp(pos.button_x !== undefined ? pos.button_x : finalX2 - 2); // Right edge, slightly left
      const buttonY = clamp(pos.button_y !== undefined ? pos.button_y : (y1 + finalY2) / 2); // Vertical center

      return {
        name: pos.name || "Unknown Item",
        name_normalized: (pos.name || "unknown item").toLowerCase().trim(),
        price: pos.price || null, // Price for better matching
        x: clamp((x1 + finalX2) / 2), // Center for legacy support
        y: clamp((y1 + finalY2) / 2), // Center for legacy support
        x1,
        y1,
        x2: finalX2,
        y2: finalY2,
        button_x: buttonX, // Specific button position
        button_y: buttonY, // Specific button position
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
