/**
 * Hybrid Menu Extraction
 * Combines PDF Vision extraction with web scraping for best results
 *
 * Supports 3 modes:
 * 1. URL only - Web scraping only
 * 2. PDF only - Vision AI on PDF only
 * 3. Hybrid (PDF + URL) - Combine both sources
 */

import { extractMenuFromImage, extractMenuItemPositions } from "./gptVisionMenuParser";
import { extractMenuFromWebsite } from "./webMenuExtractor";
import { logger } from "./logger";

interface HybridExtractionOptions {
  pdfImages?: string[]; // Array of image data URLs from PDF pages
  websiteUrl?: string; // Website URL to scrape
  venueId: string;
}

interface HybridMenuResult {
  items: any[];
  positions: any[];
  itemCount: number;
  hasWebData: boolean;
  hasPdfData: boolean;
  mode: "url-only" | "pdf-only" | "hybrid";
}

/**
 * Extract menu using the best available sources
 */
export async function extractMenuHybrid(
  options: HybridExtractionOptions
): Promise<HybridMenuResult> {
  const { pdfImages, websiteUrl, venueId } = options;

  logger.info("[HYBRID] ===== STARTING HYBRID EXTRACTION =====");

  // Validation
  if (!pdfImages && !websiteUrl) {
    logger.error("[HYBRID] No sources provided");
    throw new Error("At least one source (PDF or URL) is required");
  }

  logger.info("[HYBRID] Step 1: Validated input sources", {
    venueId,
    hasPdf: !!pdfImages,
    hasUrl: !!websiteUrl,
    pdfPageCount: pdfImages?.length || 0,
    url: websiteUrl || "N/A",
  });

  // Determine extraction mode
  const mode = getExtractionMode(!!pdfImages, !!websiteUrl);
  logger.info("[HYBRID] Step 2: Determined extraction mode", { mode });

  // MODE 1: URL Only
  if (mode === "url-only" && websiteUrl) {
    logger.info("[HYBRID] MODE 1: URL-only extraction");
    const webItems = await extractMenuFromWebsite(websiteUrl);

    return {
      items: webItems,
      positions: [], // No PDF = no hotspots
      itemCount: webItems.length,
      hasWebData: true,
      hasPdfData: false,
      mode: "url-only",
    };
  }

  // MODE 2: PDF Only
  if (mode === "pdf-only" && pdfImages) {
    logger.info("[HYBRID] MODE 2: PDF-only extraction");
    const pdfData = await extractFromPDF(pdfImages);

    return {
      items: pdfData.items,
      positions: pdfData.positions,
      itemCount: pdfData.items.length,
      hasWebData: false,
      hasPdfData: true,
      mode: "pdf-only",
    };
  }

  // MODE 3: Hybrid (PDF + URL)
  if (mode === "hybrid" && pdfImages && websiteUrl) {
    logger.info("[HYBRID] MODE 3: Hybrid extraction (PDF + URL)");

    // Extract from both sources in parallel for speed
    const [pdfData, webItems] = await Promise.all([
      extractFromPDF(pdfImages),
      extractMenuFromWebsite(websiteUrl),
    ]);

    logger.info("[HYBRID] Both extractions complete", {
      pdfItems: pdfData.items.length,
      webItems: webItems.length,
      positions: pdfData.positions.length,
    });

    // Intelligent merge
    const mergedItems = mergeWebAndPdfData(pdfData.items, webItems);

    return {
      items: mergedItems,
      positions: pdfData.positions, // Keep PDF hotspot positions
      itemCount: mergedItems.length,
      hasWebData: true,
      hasPdfData: true,
      mode: "hybrid",
    };
  }

  throw new Error("Invalid extraction mode configuration");
}

/**
 * Determine extraction mode based on available sources
 */
function getExtractionMode(hasPdf: boolean, hasUrl: boolean): "url-only" | "pdf-only" | "hybrid" {
  if (hasUrl && !hasPdf) return "url-only";
  if (hasPdf && !hasUrl) return "pdf-only";
  if (hasPdf && hasUrl) return "hybrid";
  throw new Error("No extraction source provided");
}

/**
 * Extract menu items and positions from PDF images
 */
async function extractFromPDF(pdfImages: string[]) {
  const items: any[] = [];
  const positions: any[] = [];

  logger.info("[HYBRID/PDF] Processing PDF pages", { count: pdfImages.length });

  for (let i = 0; i < pdfImages.length; i++) {
    const imageUrl = pdfImages[i];

    logger.info(`[HYBRID/PDF] Processing page ${i + 1}/${pdfImages.length}`);

    // Extract items and positions in parallel
    const [pageItems, pagePositions] = await Promise.all([
      extractMenuFromImage(imageUrl),
      extractMenuItemPositions(imageUrl),
    ]);

    // Add page index to each item
    pageItems.forEach((item: any) => {
      items.push({
        ...item,
        page_index: i,
        source: "pdf",
      });
    });

    // Add page index to each position
    pagePositions.forEach((pos: any) => {
      positions.push({
        ...pos,
        page_index: i,
      });
    });

    logger.info(
      `[HYBRID/PDF] Page ${i + 1}: ${pageItems.length} items, ${pagePositions.length} positions`
    );
  }

  logger.info("[HYBRID/PDF] PDF extraction complete", {
    totalItems: items.length,
    totalPositions: positions.length,
  });

  return { items, positions };
}

/**
 * Merge web and PDF data intelligently
 * Strategy:
 * - Use PDF items as base (we have positions for these)
 * - Enrich with web data (images, better descriptions)
 * - Add web-only items that PDF missed
 */
function mergeWebAndPdfData(pdfItems: any[], webItems: any[]): any[] {
  logger.info("[HYBRID/MERGE] Starting merge", {
    pdfCount: pdfItems.length,
    webCount: webItems.length,
  });

  // Start with PDF items (we have hotspot positions for these)
  const merged = pdfItems.map((pdfItem) => {
    // Find matching web item by name similarity
    const webMatch = webItems.find((webItem) => {
      const similarity = calculateSimilarity(
        pdfItem.name?.toLowerCase().trim() || "",
        webItem.name_normalized
      );
      return similarity > 0.8;
    });

    if (webMatch) {
      logger.info("[HYBRID/MERGE] Matched item", {
        pdf: pdfItem.name,
        web: webMatch.name,
      });

      return {
        ...pdfItem,
        // Enhance with web data
        image_url: webMatch.image_url || pdfItem.image_url,
        description: webMatch.description || pdfItem.description,
        // Keep PDF price if it exists, otherwise use web price
        price: pdfItem.price || webMatch.price,
        category: pdfItem.category || webMatch.category,
        has_web_enhancement: true,
        has_image: !!webMatch.image_url,
      };
    }

    return {
      ...pdfItem,
      has_web_enhancement: false,
      has_image: false,
    };
  });

  // Add web-only items that PDF didn't find
  webItems.forEach((webItem) => {
    const existsInPdf = merged.some(
      (m) => calculateSimilarity(m.name?.toLowerCase().trim() || "", webItem.name_normalized) > 0.8
    );

    if (!existsInPdf && webItem.name && webItem.price) {
      logger.info("[HYBRID/MERGE] Adding web-only item", { name: webItem.name });
      merged.push({
        name: webItem.name,
        description: webItem.description,
        price: webItem.price,
        category: webItem.category,
        image_url: webItem.image_url,
        source: "web_only",
        has_web_enhancement: true,
        has_image: !!webItem.image_url,
      });
    }
  });

  logger.info("[HYBRID/MERGE] Merge complete", {
    totalItems: merged.length,
    enhanced: merged.filter((i) => i.has_web_enhancement).length,
    withImages: merged.filter((i) => i.has_image).length,
    pdfOnly: merged.filter((i) => !i.has_web_enhancement).length,
    webOnly: merged.filter((i) => i.source === "web_only").length,
  });

  return merged;
}

/**
 * Calculate string similarity
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
