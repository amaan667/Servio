import { getOpenAI } from "./openai";
import fs from "fs";

/** Fractional region 0-1 for cropping (x, y = top-left; w, h = width, height). */
export interface ImageRegionFraction {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /** When set, crop this region from the page image to get image_url (PDF extraction). */
  image_region?: ImageRegionFraction;
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

IMAGE REGIONS (for PDFs with photos):
- When has_image is true, also return "image_region": { "x", "y", "w", "h" } as fractions 0-1 of the full image.
- (x, y) = top-left of the photo region, (w, h) = width and height of the photo region.
- Use the full menu page image as the coordinate space. Example: photo taking right half of page: {"x": 0.5, "y": 0.2, "w": 0.45, "h": 0.3}.
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
      return { items: [], hasMore: false, page_analyzed: pageIndex };
    }

    // Validate and clean items
    const parseRegion = (r: unknown): ImageRegionFraction | undefined => {
      if (!r || typeof r !== "object") return undefined;
      const o = r as Record<string, unknown>;
      const x = Number(o.x);
      const y = Number(o.y);
      const w = Number(o.w);
      const h = Number(o.h);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h))
        return undefined;
      if (w <= 0 || h <= 0) return undefined;
      return { x, y, w, h };
    };

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
        ...(parseRegion(item.image_region) ? { image_region: parseRegion(item.image_region) } : {}),
      }));

    const hasMore = items.length >= maxItems && !isLastPage;

    return {
      items,
      hasMore,
      page_analyzed: pageIndex,
    };
  } catch {
    return { items: [], hasMore: false, page_analyzed: pageIndex };
  }
}

/**
 * Crop a page image (data URL) by fractional region and return cropped image as data URL.
 * Used to extract item photos from PDF pages when Vision returns image_region.
 */
export async function cropPageImageToDataUrl(
  pageDataUrl: string,
  region: ImageRegionFraction
): Promise<string> {
  const base64 = pageDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 1;
    const height = meta.height ?? 1;
    const left = Math.max(0, Math.floor(region.x * width));
    const top = Math.max(0, Math.floor(region.y * height));
    const w = Math.min(width - left, Math.max(1, Math.ceil(region.w * width)));
    const h = Math.min(height - top, Math.max(1, Math.ceil(region.h * height)));
    const cropped = await sharp(buffer)
      .extract({ left, top, width: w, height: h })
      .png()
      .toBuffer();
    return `data:image/png;base64,${cropped.toString("base64")}`;
  } catch {
    return pageDataUrl;
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

  return {
    items,
    totalPages,
    pagesWithItems,
  };
}
