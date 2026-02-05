import { getOpenAI } from "./openai";
import { logger } from "./monitoring/structured-logger";
import fs from "fs";

export interface ExtractedMenuItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  allergens?: string[];
  dietary?: string[];
  spiceLevel?: string | null;
  image_url?: string;
  has_image?: boolean;
  page_index?: number;
}

export interface VisionExtractionResult {
  items: ExtractedMenuItem[];
  hasMore: boolean;
  page_analyzed: number;
}

export async function extractMenuFromImage(
  imagePathOrDataUrl: string,
  options?: {
    pageIndex?: number;
    isLastPage?: boolean;
    existingItems?: ExtractedMenuItem[];
    maxItems?: number;
  }
): Promise<VisionExtractionResult> {
  const openai = getOpenAI();
  const pageIndex = options?.pageIndex ?? 0;
  const isLastPage = options?.isLastPage ?? true;
  const maxItems = options?.maxItems ?? 100;

  let imageUrl: string;
  if (imagePathOrDataUrl.startsWith("data:")) {
    imageUrl = imagePathOrDataUrl;
  } else if (imagePathOrDataUrl.startsWith("http")) {
    imageUrl = imagePathOrDataUrl;
  } else {
    const imageBytes = fs.readFileSync(imagePathOrDataUrl).toString("base64");
    imageUrl = `data:image/png;base64,${imageBytes}`;
  }

  const prompt = `
You are an expert at reading venue menus from images/PDFs.
Extract ALL menu items you can see into this JSON format:

[
  {
    "name": "Dish Name (EXACT as on menu)",
    "description": "Description if available",
    "price": 12.50,
    "category": "Starters",
    "allergens": [],
    "dietary": [],
    "spiceLevel": null,
    "has_image": true/false
  }
]

CRITICAL RULES:
1. EXTRACT EVERY SINGLE ITEM - Don't skip anything with a name and price
2. CATEGORIES: Look for section headers (Starters, Mains, Desserts, Coffee, etc.)
3. ALLERGENS: Look for symbols (V, VG, GF, DF, N) or text mentions
4. DIETARY: Look for vegetarian (V), vegan (VG), gluten-free (GF), dairy-free (DF)
5. SPICE: Look for 🌶️ symbols or "mild/medium/hot" text

PRICING:
- Extract ALL prices
- Format: numbers only (12.50 not $12.50)
- If price range, use the average

For this page (${pageIndex + 1}):
- Max ${maxItems} items per page
`.trim();

  try {
    const startTime = Date.now();
    
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
      max_tokens: 8000,
      temperature: 0, // Deterministic: 0 = no randomness
    });

    const duration = Date.now() - startTime;
    logger.info("Vision extraction completed", {
      pageIndex,
      itemsRequested: maxItems,
      durationMs: duration,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return { items: [], hasMore: false, page_analyzed: pageIndex };
    }

    let jsonText = text;
    if (text.includes("```json")) {
      jsonText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    } else if (text.includes("```")) {
      jsonText = text.replace(/```\s*/g, "");
    }

    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { items: [], hasMore: false, page_analyzed: pageIndex };
    }

    const json = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(json)) {
      logger.warn("Vision extraction returned non-array", { pageIndex });
      return { items: [], hasMore: false, page_analyzed: pageIndex };
    }

    // Validate and clean items
    const items: ExtractedMenuItem[] = json
      .filter((item: Record<string, unknown>) => item && typeof item === "object" && item.name)
      .map((item: Record<string, unknown>) => ({
        name: String(item.name),
        description: item.description ? String(item.description) : undefined,
        price: item.price ? parseFloat(String(item.price).replace(/[^0-9.]/g, "")) : undefined,
        category: item.category ? String(item.category) : "Menu Items",
        allergens: Array.isArray(item.allergens) ? item.allergens.map(String) : [],
        dietary: Array.isArray(item.dietary) ? item.dietary.map(String) : [],
        spiceLevel: item.spiceLevel ? String(item.spiceLevel) : null,
        image_url: undefined,
        has_image: item.has_image === true,
        page_index: pageIndex,
      }));

    const hasMore = items.length >= maxItems && !isLastPage;
    
    logger.info("Vision extraction result", {
      pageIndex,
      itemsExtracted: items.length,
      hasMore,
      categories: [...new Set(items.map(i => i.category).filter(Boolean))],
    });

    return {
      items,
      hasMore,
      page_analyzed: pageIndex,
    };
  } catch (error) {
    logger.error("Vision extraction failed", {
      pageIndex,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { items: [], hasMore: false, page_analyzed: pageIndex };
  }
}

export interface ImageRegionResult {
  itemName?: string;
  has_image_region?: boolean;
}

export async function extractImageRegionsFromPDFPage(
  pdfPageImage: string
): Promise<ImageRegionResult[]> {
  const openai = getOpenAI();

  const prompt = `
Analyze this PDF/menu page and identify which items have PHOTOGRAPHs.
Return JSON:

[
  { "itemName": "Dish Name", "has_image_region": true }
]

Just mark TRUE/FALSE for whether there's a photo next to each item.
`.trim();

  try {
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
                url: pdfPageImage,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content;
    if (!text) return [];

    let jsonText = text;
    if (text.includes("```")) {
      jsonText = text.replace(/```\w*\s*/g, "").replace(/```\s*/g, "");
    }

    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

export async function extractMenuFromPDF(
  pdfImages: string[],
  onProgress?: (progress: number, total: number) => void
): Promise<{
  items: ExtractedMenuItem[];
  totalPages: number;
  pagesWithItems: number;
}> {
  const items: ExtractedMenuItem[] = [];
  const totalPages = pdfImages.length;
  let pagesWithItems = 0;

  logger.info("Starting PDF extraction", { totalPages });

  for (let i = 0; i < pdfImages.length; i++) {
    const imageUrl = pdfImages[i];
    if (!imageUrl) continue;
    
    const result = await extractMenuFromImage(imageUrl, {
      pageIndex: i,
      isLastPage: i === pdfImages.length - 1,
      existingItems: items,
      maxItems: 100,
    });

    if (result.items.length > 0) {
      pagesWithItems++;
      items.push(...result.items);
    }

    onProgress?.(i + 1, totalPages);
  }

  logger.info("PDF extraction complete", {
    totalItems: items.length,
    totalPages,
    pagesWithItems,
  });

  return {
    items,
    totalPages,
    pagesWithItems,
  };
}
