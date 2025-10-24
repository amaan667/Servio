
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
    if (!text) {
      throw new Error('No response from Vision AI');
    }
    
    logger.info('[VISION] Item extraction response length:', text.length);
    
    // Extract JSON from response (might be wrapped in markdown)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error("[VISION] No JSON array found in item extraction response:", text);
      return [];
    }
    const json = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(json)) {
      logger.error('[VISION] Parsed data is not an array:', json);
      return [];
    }
    
    logger.info('[VISION] Extracted items:', json.length);
    return json;
  } catch (err) {
    logger.error("Failed to parse item extraction JSON:", text);
    logger.error("Parse error details:", err);
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
Analyze this menu page and extract a SEPARATE bounding box for EACH individual menu item.

CRITICAL: This menu may have MULTIPLE COLUMNS (left and right). You MUST detect items in ALL columns.

For EACH INDIVIDUAL item that has a name AND price, provide:
1. Item name (exact text, English if bilingual)
2. Bounding box coordinates as percentages (0-100):
   - x1: left edge of THIS SPECIFIC ITEM
   - y1: top edge of THIS SPECIFIC ITEM
   - x2: right edge of THIS SPECIFIC ITEM (where its price ends)
   - y2: bottom edge of THIS SPECIFIC ITEM
3. Confidence score (0-1)

Return as JSON array:
[
  {
    "name": "Labneh",
    "x1": 5,
    "y1": 15,
    "x2": 45,
    "y2": 18,
    "confidence": 0.95
  },
  {
    "name": "Chicken Burger",
    "x1": 55,
    "y1": 15,
    "x2": 95,
    "y2": 18,
    "confidence": 0.95
  },
  ...
]

CRITICAL RULES:
- EACH item gets its OWN bounding box
- Left column items: x1 ~5-10, x2 ~45-48
- Right column items: x1 ~52-55, x2 ~95-98
- DO NOT create one large box covering multiple items
- Include ALL items from ALL columns
- Bounding box should be tight around JUST that item (name + description + price)
- y1 and y2 should tightly wrap just that one item (height typically 3-5%)
- Do NOT include section headers or category titles
- Be very precise - these create clickable areas
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
    if (!text) {
      throw new Error('No response from Vision AI');
    }
    
    logger.info('[VISION] Raw response length:', text.length);
    logger.info('[VISION] First 200 chars:', text.substring(0, 200));
    
    // Extract JSON from response (might be wrapped in markdown or have explanation text)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.error('[VISION] No JSON array found in response:', text);
      // Return empty array instead of crashing
      return [];
    }
    
    const positions = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(positions)) {
      logger.error('[VISION] Parsed data is not an array:', positions);
      return [];
    }
    
    logger.info('[VISION] Parsed positions:', positions.length);
    
    // Log first few positions for debugging
    console.log('[VISION] Sample positions (first 3):', JSON.stringify(positions.slice(0, 3), null, 2));
    
    // Validate positions
    positions.forEach((pos: any, index: number) => {
      if (!pos.name || !pos.x1 || !pos.y1 || !pos.x2 || !pos.y2) {
        console.warn(`[VISION] ⚠️ Position ${index} missing required fields:`, pos);
      }
      if (pos.x2 - pos.x1 > 50) {
        console.warn(`[VISION] ⚠️ Position ${index} TOO WIDE (${pos.x2 - pos.x1}%):`, pos.name);
      }
    });
    
    // Convert bounding box format to include both center point (for backward compatibility)
    // and full bounding box for overlay cards
    return positions.map((pos: any) => ({
      name: pos.name || 'Unknown Item',
      // Keep legacy x,y as center point for backward compatibility
      x: pos.x1 !== undefined && pos.x2 !== undefined ? (pos.x1 + pos.x2) / 2 : pos.x || 50,
      y: pos.y1 !== undefined && pos.y2 !== undefined ? (pos.y1 + pos.y2) / 2 : pos.y || 50,
      // Add bounding box coordinates
      x1: pos.x1 !== undefined ? pos.x1 : (pos.x || 50) - 5,
      y1: pos.y1 !== undefined ? pos.y1 : (pos.y || 50) - 3,
      x2: pos.x2 !== undefined ? pos.x2 : (pos.x || 50) + 5,
      y2: pos.y2 !== undefined ? pos.y2 : (pos.y || 50) + 3,
      confidence: pos.confidence || 0.8,
    }));
  } catch (err) {
    logger.error("Failed to parse menu positions JSON:", text);
    logger.error("Parse error details:", err);
    // Return empty array instead of crashing - menu will still work without hotspots
    return [];
  }
}
