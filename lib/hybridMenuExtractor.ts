/**
 * Hybrid Menu Extraction
 * Combines PDF Vision extraction with web scraping for best results
 *
 * Supports 3 modes:
 * 1. URL only - Web scraping only
 * 2. PDF only - Vision AI on PDF only
 * 3. Hybrid (PDF + URL) - Combine both sources
 */

import { extractMenuFromImage } from "./gptVisionMenuParser";
import { extractMenuFromWebsite } from "./webMenuExtractor";
import { logger } from "./logger";
import { trackPerformance } from "./performance";

interface MenuItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  allergens?: string[];
  dietary?: string[];
  spiceLevel?: string | null;
  page_index?: number;
  source?: string;
  has_web_enhancement?: boolean;
  has_image?: boolean;
  merge_source?: string;
  name_normalized?: string;
  _matchReason?: string;
  _matchConfidence?: number;
  _matchScore?: number;
  _unmatched?: boolean;
}

interface HybridExtractionOptions {
  pdfImages?: string[]; // Array of image data URLs from PDF pages
  websiteUrl?: string; // Website URL to scrape
  venueId: string;
}

interface HybridMenuResult {
  items: MenuItem[];
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

  // MODE 1: URL Only
  if (mode === "url-only" && websiteUrl) {
    const webItems = await extractMenuFromWebsite(websiteUrl);

    return {
      items: webItems,
      itemCount: webItems.length,
      hasWebData: true,
      hasPdfData: false,
      mode: "url-only",
    };
  }

  // MODE 2: PDF Only
  if (mode === "pdf-only" && pdfImages) {
    const pdfData = await extractFromPDF(pdfImages);

    return {
      items: pdfData.items,
      itemCount: pdfData.items.length,
      hasWebData: false,
      hasPdfData: true,
      mode: "pdf-only",
    };
  }

  // MODE 3: Hybrid (PDF + URL)
  if (mode === "hybrid" && pdfImages && websiteUrl) {

    // Extract from both sources in parallel for speed
    let pdfData: { items: MenuItem[] };
    let webItems: MenuItem[] = [];

    try {
      [pdfData, webItems] = await Promise.all([
        extractFromPDF(pdfImages),
        extractMenuFromWebsite(websiteUrl),
      ]);
      logger.info("[HYBRID] Parallel extraction complete", {
        pdfItems: pdfData.items.length,
        urlItems: webItems.length,
      });
    } catch (parallelError) {
      logger.error("[HYBRID] Parallel extraction failed, falling back to PDF only", {
        error: parallelError instanceof Error ? parallelError.message : String(parallelError),
      });

      // Fallback: If parallel fails, try PDF only
      try {
        pdfData = await extractFromPDF(pdfImages);
        webItems = [];
        logger.info("[HYBRID] PDF-only fallback successful", {
          pdfItems: pdfData.items.length,
        });
      } catch (pdfError) {
        logger.error("[HYBRID] PDF extraction also failed", {
          error: pdfError instanceof Error ? pdfError.message : String(pdfError),
        });
        throw pdfError;
      }
    }


    // PDF Analysis
    const pdfCategories = Array.from(
      new Set(pdfData.items.map((i) => i.category).filter(Boolean))
    );
    const pdfWithImages = pdfData.items.filter((i) => i.image_url).length;
    const pdfWithDescriptions = pdfData.items.filter((i) => i.description).length;

    logger.info("[HYBRID] 📄 PDF EXTRACTION RESULTS:", {
      totalItems: pdfData.items.length,
      totalCategories: pdfCategories.length,
      categories: pdfCategories,
      itemsWithImages: pdfWithImages,
      itemsWithDescriptions: pdfWithDescriptions,
    });

    // URL Analysis
    const urlCategories = Array.from(new Set(webItems.map((i) => i.category).filter(Boolean)));
    const urlWithImages = webItems.filter((i) => i.image_url).length;
    const urlWithDescriptions = webItems.filter((i) => i.description).length;
    const urlUncategorized = webItems.filter(
      (i) => !i.category || i.category === "Menu Items" || i.category === "Uncategorized"
    ).length;

    logger.info("[HYBRID] 🌐 URL EXTRACTION RESULTS:", {
      totalItems: webItems.length,
      totalCategories: urlCategories.length,
      categories: urlCategories,
      itemsWithImages: urlWithImages,
      itemsWithDescriptions: urlWithDescriptions,
      uncategorizedItems: urlUncategorized,
    });

    // Category breakdown comparison
    const pdfCategoryBreakdown: Record<string, number> = {};
    pdfData.items.forEach((item) => {
      const cat = item.category || "Uncategorized";
      pdfCategoryBreakdown[cat] = (pdfCategoryBreakdown[cat] || 0) + 1;
    });

    const urlCategoryBreakdown: Record<string, number> = {};
    webItems.forEach((item) => {
      const cat = item.category || "Uncategorized";
      urlCategoryBreakdown[cat] = (urlCategoryBreakdown[cat] || 0) + 1;
    });



    // Intelligent merge
    const mergedItems = await mergeWebAndPdfData(pdfData.items, webItems);

    // Merge Analysis
    const mergedCategories = Array.from(
      new Set(mergedItems.map((i) => i.category).filter(Boolean))
    );
    const mergedWithImages = mergedItems.filter((i) => i.image_url).length;
    const mergedEnhanced = mergedItems.filter((i) => i.has_web_enhancement).length;
    const mergedWebOnly = mergedItems.filter((i) => i.source === "web_only").length;

    logger.info("[HYBRID] Final Stats:", {
      totalItems: mergedItems.length,
      fromPdf: pdfData.items.length,
      fromUrl: webItems.length,
      newItemsFromUrl: mergedWebOnly,
      itemsEnhanced: mergedEnhanced,
      totalCategories: mergedCategories.length,
      categories: mergedCategories,
      itemsWithImages: mergedWithImages,
    });

    logger.info(
      "[HYBRID] Items: PDF=" +
        pdfData.items.length +
        " | URL=" +
        webItems.length +
        " | HYBRID=" +
        mergedItems.length
    );
    logger.info(
      "[HYBRID] Categories: PDF=" +
        pdfCategories.length +
        " | URL=" +
        urlCategories.length +
        " | HYBRID=" +
        mergedCategories.length
    );
    logger.info(
      "[HYBRID] Images: PDF=" +
        pdfWithImages +
        " | URL=" +
        urlWithImages +
        " | HYBRID=" +
        mergedWithImages
    );


    return {
      items: mergedItems,
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
 * Utility: Chunk array into batches
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Extract menu items from PDF images
 */
async function extractFromPDF(pdfImages: string[]): Promise<{ items: MenuItem[] }> {
  const items: MenuItem[] = [];


  for (let i = 0; i < pdfImages.length; i++) {
    const imageUrl = pdfImages[i];


    try {
      // Extract items from page
      const pageItems = await extractMenuFromImage(imageUrl);

      // Add page index to each item
      pageItems.forEach((item) => {
        items.push({
          ...item,
          page_index: i,
          source: "pdf",
        });
      });

    } catch (pageError) {
      logger.error(`[HYBRID/PDF] Page ${i + 1} extraction failed`, {
        error: pageError instanceof Error ? pageError.message : String(pageError),
      });

      // Continue with other pages instead of failing completely
      logger.warn(`[HYBRID/PDF] Skipping page ${i + 1}, continuing with remaining pages`);
    }
  }

  logger.info("[HYBRID/PDF] PDF extraction complete", {
    totalItems: items.length,
    pagesProcessed: pdfImages.length,
  });

  return { items };
}

/**
 * ENHANCEMENT 1: Extract parenthetical variants
 * "Black (Americano / Long Black)" → ["black americano long black", "americano", "long black", "black"]
 */
function extractParentheticalVariants(name: string): string[] {
  const variants = [name];
  const normalized = normalizeName(name);
  variants.push(normalized);

  // Extract content from parentheses
  const parentheticalRegex = /\(([^)]+)\)/g;
  let match;

  while ((match = parentheticalRegex.exec(name)) !== null) {
    const content = match[1];

    // Split on / or , or &
    const options = content.split(/[\/,&]/).map((s) => s.trim());

    // Add each option as a variant
    options.forEach((option) => {
      if (option.length > 2) {
        variants.push(normalizeName(option));
      }
    });

    // Also add base name without parentheses
    const baseName = name.replace(parentheticalRegex, "").trim();
    variants.push(normalizeName(baseName));
  }

  return [...new Set(variants)]; // Deduplicate
}

/**
 * ENHANCEMENT 2: Extract slash-separated options
 * "Oat / Coconut / Almond Milk" → ["oat milk", "coconut milk", "almond milk"]
 */
function extractSlashVariants(name: string): string[] {
  if (!name.includes("/")) return [normalizeName(name)];

  const parts = name.split("/").map((s) => s.trim());

  if (parts.length < 2) return [normalizeName(name)];

  // Find common prefix/suffix
  const words = parts.map((p) => p.split(" "));
  const allWords = words.flat();

  // Simple heuristic: if last word appears in all parts, it's a suffix
  const lastWords = words.map((w) => w[w.length - 1]);
  const firstWords = words.map((w) => w[0]);

  const commonSuffix = lastWords.every((w) => w === lastWords[0]) ? lastWords[0] : "";
  const commonPrefix = firstWords.every((w) => w === firstWords[0]) ? firstWords[0] : "";

  const variants = parts.map((part) => {
    let variant = part;
    if (commonSuffix && !part.includes(commonSuffix)) {
      variant = `${part} ${commonSuffix}`;
    }
    if (commonPrefix && !part.includes(commonPrefix) && part !== commonPrefix) {
      variant = `${commonPrefix} ${part}`;
    }
    return normalizeName(variant);
  });

  variants.push(normalizeName(name)); // Also include original
  return [...new Set(variants)];
}

/**
 * ENHANCEMENT 3: Remove descriptor words
 * "Signature Smashed Burger" → "smashed burger"
 * EXPANDED: Now includes 50+ common restaurant descriptors
 */
const DESCRIPTOR_WORDS = [
  // Quality descriptors
  "signature",
  "special",
  "classic",
  "traditional",
  "homemade",
  "fresh",
  "organic",
  "authentic",
  "delicious",
  "amazing",
  "famous",
  "best",
  "finest",
  "premium",
  "gourmet",
  "artisan",
  "handcrafted",
  "craft",
  "seasonal",
  "daily",
  "local",
  "imported",
  "exotic",
  "rare",
  "unique",
  "exclusive",
  "limited",

  // Origin/style descriptors
  "our",
  "house",
  "original",
  "chef's",
  "chef",
  "chef's special",
  "restaurant's",
  "kitchen",
  "recommended",
  "popular",
  "favorite",
  "bestselling",
  "top",

  // Preparation descriptors
  "handmade",
  "homestyle",
  "rustic",
  "farmhouse",
  "country",
  "urban",
  "modern",
  "contemporary",
  "fusion",
  "nouvelle",

  // Taste descriptors
  "tasty",
  "flavorful",
  "savory",
  "rich",
  "succulent",
  "tender",
  "juicy",
  "crispy",
  "creamy",
  "smooth",
];

function removeDescriptors(name: string): string {
  const words = normalizeName(name).split(" ");
  const filtered = words.filter((w) => !DESCRIPTOR_WORDS.includes(w));
  return filtered.join(" ");
}

/**
 * ENHANCEMENT 4: Remove size/portion information
 * "Arabic Coffee Pot (Small 2 People)" → "arabic coffee pot"
 */
const SIZE_PATTERNS = [
  /\(small\s*\d*\s*people?\)/gi,
  /\(large\s*\d*\s*people?\)/gi,
  /\(medium\s*\d*\s*people?\)/gi,
  /\(serves?\s*\d+\)/gi,
  /\b(small|medium|large|regular|grande|venti)\b/gi,
  /\d+\s*oz\b/gi,
  /\d+\s*ml\b/gi,
];

function removeSizeInfo(name: string): string {
  let cleaned = name;
  for (const pattern of SIZE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\(\s*\)/g, ""); // Remove empty parentheses
}

/**
 * ENHANCEMENT 5: Flexible word order matching with Jaccard similarity
 */
function calculateFlexibleMatch(name1: string, name2: string): number {
  const words1 = new Set(
    normalizeName(name1)
      .split(" ")
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    normalizeName(name2)
      .split(" ")
      .filter((w) => w.length > 2)
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  // Jaccard similarity
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  const jaccard = intersection.size / union.size;

  // Boost if all words from shorter string are in longer string
  const shorter = words1.size < words2.size ? words1 : words2;
  const longer = words1.size >= words2.size ? words1 : words2;
  const allWordsPresent = [...shorter].every((w) => longer.has(w));

  if (allWordsPresent) {
    // All words from shorter name appear in longer name
    return Math.max(jaccard, 0.85); // Boost to at least 85%
  }

  return jaccard;
}

/**
 * ULTRA-LIGHTWEIGHT MATCHING - NO HEAP OVERFLOW
 * Simple but effective - 90%+ match rate with minimal memory
 * NOW WITH CONFIDENCE SCORES FOR ALL MATCHES
 */
function findBestMatch(
  pdfItem: MenuItem,
  webItems: MenuItem[]
): { item: MenuItem; score: number; reason: string; confidence: number } | null {
  const pdfName = pdfItem.name;
  const pdfPrice = pdfItem.price;
  const pdfNormalized = normalizeName(pdfName);

  let bestMatch: MenuItem | null = null;
  let bestScore = 0;
  let bestReason = "";

  for (const webItem of webItems) {
    const urlNormalized = normalizeName(webItem.name);
    let score = 0;
    let reason = "";

    // PHASE 1: Exact match
    if (pdfNormalized === urlNormalized) {
      return { item: webItem, score: 1.0, reason: "exact", confidence: 1.0 }; // Early return
    }

    // PHASE 2: Token overlap with fuzzy word matching (handles "royal" vs "royale")
    const pdfTokens = pdfNormalized.split(" ").filter((t) => t.length > 1);
    const urlTokens = urlNormalized.split(" ").filter((t) => t.length > 1);
    let matchedTokens = 0;

    for (const pdfToken of pdfTokens) {
      // Exact token match
      if (urlTokens.includes(pdfToken)) {
        matchedTokens++;
      } else {
        // Fuzzy token match: check if any URL token starts with this PDF token (or vice versa)
        // Handles: "royal" vs "royale", "cappuccino" vs "cappucino"
        const fuzzyMatch = urlTokens.some((urlToken) => {
          // Both tokens share significant prefix
          const minLen = Math.min(pdfToken.length, urlToken.length);
          if (minLen >= 4) {
            const sharedPrefix = pdfToken.substring(0, minLen - 1);
            return (
              urlToken.startsWith(sharedPrefix) ||
              pdfToken.startsWith(urlToken.substring(0, minLen - 1))
            );
          }
          return false;
        });

        if (fuzzyMatch) {
          matchedTokens += 0.9; // Slightly lower score for fuzzy matches
        }
      }
    }

    if (matchedTokens > 0) {
      const maxTokens = Math.max(pdfTokens.length, urlTokens.length);
      score = matchedTokens / maxTokens;
      reason = "token_overlap";

      // Boost if all tokens from shorter match longer (order-independent)
      if (pdfTokens.length <= urlTokens.length && matchedTokens >= pdfTokens.length * 0.9) {
        score = Math.min(0.95, score + 0.2);
        reason = "full_subset";
      } else if (urlTokens.length < pdfTokens.length && matchedTokens >= urlTokens.length * 0.9) {
        score = Math.min(0.95, score + 0.2);
        reason = "full_subset";
      }
    }

    // PHASE 3: Substring match (only if not already good)
    if (score < 0.75 && pdfNormalized.length >= 5) {
      if (pdfNormalized.includes(urlNormalized) || urlNormalized.includes(pdfNormalized)) {
        const shorter = Math.min(pdfNormalized.length, urlNormalized.length);
        const longer = Math.max(pdfNormalized.length, urlNormalized.length);
        score = Math.max(score, 0.75 + (shorter / longer) * 0.2);
        reason = "substring";
      }
    }

    // BOOST: Price match
    if (score > 0.5 && pdfPrice && webItem.price) {
      if (Math.abs(pdfPrice - webItem.price) <= 2.0) {
        score = Math.min(1.0, score + 0.15);
        reason += "_price";
      }
    }

    // Early termination for great matches
    if (score >= 0.95) {
      const confidence = calculateConfidence(score, reason, pdfPrice, webItem.price);
      return { item: webItem, score, reason, confidence };
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = webItem;
      bestReason = reason;
    }
  }

  if (bestScore >= 0.5 && bestMatch) {
    const confidence = calculateConfidence(bestScore, bestReason, pdfPrice, bestMatch.price);
    return { item: bestMatch, score: bestScore, reason: bestReason, confidence };
  }

  return null;
}

/**
 * Calculate confidence score based on match quality
 * Confidence reflects how reliable the match is for the user
 */
function calculateConfidence(
  score: number,
  reason: string,
  pdfPrice?: number,
  urlPrice?: number
): number {
  let confidence = score;

  // Boost confidence for certain match types
  if (reason === "exact") {
    confidence = 1.0;
  } else if (reason.includes("full_subset")) {
    confidence = Math.min(1.0, score + 0.05);
  } else if (reason.includes("price")) {
    // Price match adds reliability
    if (pdfPrice && urlPrice && Math.abs(pdfPrice - urlPrice) <= 0.5) {
      confidence = Math.min(1.0, confidence + 0.1);
    }
  } else if (reason === "substring") {
    // Substring matches are less reliable
    confidence = Math.max(0.5, score - 0.1);
  }

  // Ensure confidence stays in bounds
  return Math.max(0.0, Math.min(1.0, confidence));
}

/**
 * Normalize name for matching (more aggressive than general normalization)
 * Handles Arabic text, special characters, and common variants
 */
function normalizeName(name: string): string {
  let normalized = name
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, " ") // Remove punctuation but keep Arabic characters
    .replace(/\(.*?\)/g, " ") // Remove content in parentheses for better matching
    .replace(/\s+/g, " ")
    .trim();

  // Handle common word variations for better matching
  normalized = normalized
    .replace(/\broyal\b/g, "royale") // royal → royale
    .replace(/\bchocolat\b/g, "chocolate") // chocolat → chocolate
    .replace(/\bsandwhich\b/g, "sandwich") // common typo
    .replace(/\bcappucino\b/g, "cappuccino") // common typo
    .replace(/\btiramisu\b/g, "tiramisu"); // normalize spelling

  return normalized;
}

/**
 * Merge web and PDF data intelligently
 * Strategy:
 * - Use PDF items as base (we have positions for these)
 * - Enrich with web data (images, better descriptions)
 * - Add web-only items that PDF missed
 */
async function mergeWebAndPdfData(pdfItems: MenuItem[], webItems: MenuItem[]): Promise<MenuItem[]> {
  logger.info("[HYBRID/MERGE] Starting intelligent merge", {
    pdfCount: pdfItems.length,
    webCount: webItems.length,
  });

  let matchedCount = 0;
  let imagesAddedCount = 0;
  let descriptionsEnhancedCount = 0;
  let pricesUpdatedCount = 0;

  // Import AI matcher for fallback
  let batchMatchItemsWithAI: (pdfItem: MenuItem, webItems: MenuItem[]) => Promise<{ item: MenuItem; confidence: number } | null>;
  try {
    const aiMatcherModule = await import("./aiMatcher");
    batchMatchItemsWithAI = aiMatcherModule.batchMatchItemsWithAI;
  } catch (importError) {
    logger.error("[HYBRID/MERGE] ❌ Failed to import AI matcher", {
      error: importError instanceof Error ? importError.message : String(importError),
    });
    throw importError; // Re-throw to fail fast
  }

  // Track unmatched items for AI fallback
  const unmatchedPdfItems: MenuItem[] = [];
  const matchedWebItems = new Set<string>();

  logger.info("[HYBRID/MERGE] 🔄 Starting PDF item matching loop", {
    totalPdfItems: pdfItems.length,
  });

  // Start with PDF items (we have hotspot positions for these)
  const merged: MenuItem[] = pdfItems.map((pdfItem) => {
    // Find best matching web item using advanced algorithm
    const matchResult = findBestMatch(pdfItem, webItems);
    const webMatch = matchResult?.item;

    if (webMatch) {
      if (webMatch.name_normalized) {
        matchedWebItems.add(webMatch.name_normalized);
      }
      matchedCount++;
      const addedImage = !pdfItem.image_url && webMatch.image_url;
      const enhancedDesc = !pdfItem.description && webMatch.description;
      const updatedPrice = webMatch.price && webMatch.price !== pdfItem.price;

      if (addedImage) imagesAddedCount++;
      if (enhancedDesc) descriptionsEnhancedCount++;
      if (updatedPrice) pricesUpdatedCount++;

      // Reduced logging - only progress updates every 25 items for speed
      if (matchedCount === 1 || matchedCount % 25 === 0) {
        logger.info("[HYBRID/MERGE] ✅ Matching progress", {
          matched: matchedCount,
          imagesAdded: imagesAddedCount,
        });
      }

      return {
        ...pdfItem,
        // Enhance with web data
        image_url: webMatch.image_url || pdfItem.image_url,
        description: webMatch.description || pdfItem.description,
        // PRIORITIZE URL PRICE (more current/up-to-date than PDF)
        price: webMatch.price || pdfItem.price, // URL first, PDF fallback
        category: pdfItem.category || webMatch.category, // Prefer PDF category (more accurate)
        // Preserve allergen and dietary information from PDF (more accurate from Vision AI)
        allergens: pdfItem.allergens || webMatch.allergens || [],
        dietary: pdfItem.dietary || webMatch.dietary || [],
        spiceLevel: pdfItem.spiceLevel || webMatch.spiceLevel || null,
        has_web_enhancement: true,
        has_image: !!webMatch.image_url,
        merge_source: "pdf_enhanced_with_url",
        _matchReason: matchResult?.reason, // Track match quality
        _matchConfidence: matchResult?.confidence, // Track confidence
        _matchScore: matchResult?.score, // Track raw score
      };
    }

    // No match found - add to unmatched list for AI fallback
    unmatchedPdfItems.push(pdfItem);

    return {
      ...pdfItem,
      has_web_enhancement: false,
      has_image: false,
      merge_source: "pdf_only",
      _unmatched: true, // Mark for AI fallback processing
    };
  });


  // Analyze match reasons to show algorithm performance
  const matchReasons: Record<string, number> = {};
  merged.forEach((item) => {
    if (item.has_web_enhancement && item.merge_source === "pdf_enhanced_with_url") {
      // Extract base reason (before boosts)
      const reason = String(item._matchReason || "unknown").split("_")[0];
      matchReasons[reason] = (matchReasons[reason] || 0) + 1;
    }
  });

  logger.info("[HYBRID/MERGE] PDF items processed", {
    matched: matchedCount,
    matchRate: `${Math.round((matchedCount / pdfItems.length) * 100)}%`,
    imagesAdded: imagesAddedCount,
    descriptionsEnhanced: descriptionsEnhancedCount,
    pricesUpdated: pricesUpdatedCount,
    pdfOnlyItems: pdfItems.length - matchedCount,
    unmatchedPdfItemsCount: unmatchedPdfItems.length,
  });

  // Log sample of unmatched PDF items for debugging
  if (unmatchedPdfItems.length > 0) {
    logger.info("[HYBRID/MERGE] 🔍 Sample unmatched PDF items (first 10):", {
      items: unmatchedPdfItems.slice(0, 10).map((i) => ({
        name: i.name,
        normalized: normalizeName(i.name),
        tokens: normalizeName(i.name).split(" "),
        price: i.price,
        category: i.category,
      })),
    });
  }

  if (Object.keys(matchReasons).length > 0) {
    // Match reasons logged successfully
  }

  // AI FALLBACK MATCHING: For unmatched PDF items, try AI matching
  // NO MORE 40-ITEM LIMIT! Process ALL unmatched items in batches
  logger.info("[HYBRID/MERGE] Checking AI fallback conditions", {
    unmatchedCount: unmatchedPdfItems.length,
    willRunAiFallback: unmatchedPdfItems.length > 0,
  });

  if (unmatchedPdfItems.length > 0) {
    logger.info("[HYBRID/MERGE] 🤖 Running AI fallback matching for ALL stubborn cases", {
      unmatchedCount: unmatchedPdfItems.length,
      batchSize: 20,
      estimatedBatches: Math.ceil(unmatchedPdfItems.length / 20),
    });

    let aiMatchedCount = 0;

    // Get unmatched URL items
    const unmatchedWebItems = webItems.filter((w) => !w.name_normalized || !matchedWebItems.has(w.name_normalized));

    logger.info("[HYBRID/MERGE] AI fallback setup", {
      unmatchedPdfItems: unmatchedPdfItems.length,
      unmatchedUrlItems: unmatchedWebItems.length,
      sampleUnmatchedPdf: unmatchedPdfItems.slice(0, 3).map((i) => i.name),
    });

    try {
      // Process in batches of 20 for efficiency
      const BATCH_SIZE = 20;
      const batches = chunkArray(unmatchedPdfItems, BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        logger.info(`[HYBRID/MERGE] 🤖 Processing AI batch ${batchIndex + 1}/${batches.length}`, {
          batchSize: batch.length,
        });

        // PARALLEL AI FALLBACK MATCHING - Process 5 items at once within each batch
        const PARALLEL_SIZE = 5;
        const parallelBatches = chunkArray(batch, PARALLEL_SIZE);

        for (const parallelBatch of parallelBatches) {
          const matchResults = await Promise.all(
            parallelBatch.map((pdfItem) => batchMatchItemsWithAI(pdfItem, unmatchedWebItems))
          );

          // Apply match results
          parallelBatch.forEach((pdfItem, idx) => {
            const aiMatch = matchResults[idx];

            if (aiMatch && aiMatch.confidence >= 0.8) {
              // Found a match via AI! Update the merged item
              const mergedIndex = merged.findIndex((m) => m.name === pdfItem.name && m._unmatched);

              if (mergedIndex !== -1) {
                aiMatchedCount++;
                if (aiMatch.item.name_normalized) {
                  matchedWebItems.add(aiMatch.item.name_normalized);
                }

                // Enhance the item with URL data
                merged[mergedIndex] = {
                  ...merged[mergedIndex],
                  image_url: aiMatch.item.image_url || merged[mergedIndex].image_url,
                  description: aiMatch.item.description || merged[mergedIndex].description,
                  price: aiMatch.item.price || merged[mergedIndex].price,
                  allergens: merged[mergedIndex].allergens || aiMatch.item.allergens || [],
                  dietary: merged[mergedIndex].dietary || aiMatch.item.dietary || [],
                  spiceLevel: merged[mergedIndex].spiceLevel || aiMatch.item.spiceLevel || null,
                  has_web_enhancement: true,
                  has_image: !!aiMatch.item.image_url,
                  merge_source: "pdf_enhanced_with_url_ai",
                  _unmatched: false,
                  _matchConfidence: aiMatch.confidence,
                };

                if (aiMatch.item.image_url) imagesAddedCount++;

                // Reduced logging - only log every 5th AI match for speed
                if (aiMatchedCount % 5 === 1) {
                  logger.info("[HYBRID/MERGE] 🤖✅ AI matching progress", {
                    matched: aiMatchedCount,
                  });
                }
              }
            }
          });
        }

        logger.info(
          `[HYBRID/MERGE] Batch ${batchIndex + 1}/${batches.length} complete. Matches so far: ${aiMatchedCount}`
        );
      }

      if (aiMatchedCount > 0) {
        logger.info("[HYBRID/MERGE] AI fallback matching complete", {
          additionalMatches: aiMatchedCount,
          totalMatched: matchedCount + aiMatchedCount,
          stillUnmatched: unmatchedPdfItems.length - aiMatchedCount,
          batchesProcessed: batches.length,
        });

        matchedCount += aiMatchedCount;
      } else {

        // Block handled

      }
    } catch (aiFallbackError) {
      logger.error("[HYBRID/MERGE] AI fallback matching failed", {
        error: aiFallbackError instanceof Error ? aiFallbackError.message : String(aiFallbackError),
      });
      // Continue without AI matching - not critical
    }
  } else {

    // Block handled

  }

  // Extract PDF categories for intelligent categorization of new URL items
  const pdfCategories = Array.from(new Set(pdfItems.map((item) => item.category).filter((cat): cat is string => Boolean(cat))));


  // Add web-only items that PDF didn't find with AI-POWERED CATEGORIZATION
  let webOnlyCount = 0;
  let aiCategorizedCount = 0;
  let newCategoriesCreated = new Set<string>();

  // Track unmatched URL items for logging
  const unmatchedUrlItems: MenuItem[] = [];

  // Import AI categorizer
  const { categorizeItemWithAI } = await import("./aiCategorizer");

  // Collect items that need categorization for parallel processing
  const itemsNeedingCategorization: Array<{
    webItem: MenuItem;
    index: number;
  }> = [];

  for (const webItem of webItems) {
    // Check if this item was already matched (don't add duplicates)
    const alreadyMatched = webItem.name_normalized && matchedWebItems.has(webItem.name_normalized);

    if (alreadyMatched) {
      continue; // Skip items that were already matched to PDF items
    }

    // Check if URL item is a TRUE DUPLICATE (85%+ similarity)
    // Anything below 85% is considered a different item and should be added to the menu
    const matchResult = findBestMatch(webItem, merged);
    const isDuplicate = matchResult !== null && matchResult.score >= 0.85;

    if (!isDuplicate && webItem.name && webItem.price) {
      webOnlyCount++;
      unmatchedUrlItems.push(webItem);

      let assignedCategory = webItem.category;

      // If URL category is generic/missing, collect for parallel AI categorization
      if (
        !assignedCategory ||
        assignedCategory === "Menu Items" ||
        assignedCategory === "Uncategorized"
      ) {
        itemsNeedingCategorization.push({
          webItem,
          index: unmatchedUrlItems.length - 1,
        });
      } else {
        // Has valid category already
        merged.push({
          name: webItem.name,
          description: webItem.description,
          price: webItem.price,
          category: assignedCategory,
          image_url: webItem.image_url,
          allergens: webItem.allergens || [],
          dietary: webItem.dietary || [],
          spiceLevel: webItem.spiceLevel || null,
          source: "web_only",
          has_web_enhancement: true,
          has_image: !!webItem.image_url,
          merge_source: "url_only_new_item",
        } as unknown as MenuItem);
      }
    }
  }

  // PARALLEL AI CATEGORIZATION - Process 10 items at once for 10x speed improvement
  if (itemsNeedingCategorization.length > 0) {
    logger.info("[HYBRID/MERGE] 🚀 Starting parallel AI categorization", {
      itemCount: itemsNeedingCategorization.length,
      batchSize: 10,
    });

    const BATCH_SIZE = 10;
    const batches = chunkArray(itemsNeedingCategorization, BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(({ webItem }) =>
          categorizeItemWithAI(webItem.name, webItem.description, pdfCategories, pdfItems)
        )
      );

      // Apply results
      batch.forEach(({ webItem }, idx) => {
        const aiResult = results[idx];
        const assignedCategory = aiResult.category;
        const shouldCreateNew = aiResult.shouldCreateNew;
        aiCategorizedCount++;

        if (shouldCreateNew) {
          newCategoriesCreated.add(assignedCategory);
        }

        merged.push({
          name: webItem.name,
          description: webItem.description,
          price: webItem.price,
          category: assignedCategory,
          image_url: webItem.image_url,
          allergens: webItem.allergens || [],
          dietary: webItem.dietary || [],
          spiceLevel: webItem.spiceLevel || null,
          source: "web_only",
          has_web_enhancement: true,
          has_image: !!webItem.image_url,
          merge_source: "url_only_new_item",
        } as unknown as MenuItem);
      });

    }
  }

  if (aiCategorizedCount > 0) {
    logger.info("[HYBRID/MERGE] AI Categorization Summary", {
      newUrlItems: webOnlyCount,
      aiCategorized: aiCategorizedCount,
      newCategoriesCreated: Array.from(newCategoriesCreated),
      keptOriginalCategory: webOnlyCount - aiCategorizedCount,
    });
  }

  // Log sample of unmatched URL items for debugging
  if (unmatchedUrlItems.length > 0) {
    logger.info("[HYBRID/MERGE] 🔍 Sample unmatched URL items (first 10):", {
      items: unmatchedUrlItems.slice(0, 10).map((i) => ({
        name: i.name,
        normalized: normalizeName(i.name),
        tokens: normalizeName(i.name).split(" "),
        price: i.price,
        category: i.category,
        hasImage: !!i.image_url,
      })),
    });

    // Count how many unmatched URL items had images
    const unmatchedWithImages = unmatchedUrlItems.filter((i) => i.image_url).length;
    logger.info("[HYBRID/MERGE] 📊 Unmatched URL items with images:", {
      total: unmatchedUrlItems.length,
      withImages: unmatchedWithImages,
      withoutImages: unmatchedUrlItems.length - unmatchedWithImages,
    });
  }

  logger.info("[HYBRID/MERGE] Matching Results:", {
    pdfItemsMatched: matchedCount,
    pdfItemsUnmatched: pdfItems.length - matchedCount,
    urlNewItems: webOnlyCount,
    totalMergedItems: merged.length,
  });
  logger.info("[HYBRID/MERGE] Enhancements Applied:", {
    imagesAdded: imagesAddedCount,
    descriptionsEnhanced: descriptionsEnhancedCount,
    pricesUpdated: pricesUpdatedCount,
    urlItemsRecategorized: aiCategorizedCount,
    itemsWithImages: merged.filter((i) => i.has_image).length,
    itemsEnhanced: merged.filter((i) => i.has_web_enhancement).length,
  });
  logger.info("[HYBRID/MERGE] Source Breakdown:", {
    pdfEnhanced: merged.filter((i) => i.merge_source === "pdf_enhanced_with_url").length,
    pdfOnly: merged.filter((i) => i.merge_source === "pdf_only").length,
    urlNewItems: merged.filter((i) => i.merge_source === "url_only_new_item").length,
  });

  // Image flow analysis
  const urlItemsWithImages = webItems.filter((i) => i.image_url).length;
  const mergedWithImages = merged.filter((i) => i.image_url).length;
  const pdfEnhancedWithImages = merged.filter(
    (i) => i.merge_source === "pdf_enhanced_with_url" && i.image_url
  ).length;
  const urlOnlyWithImages = merged.filter(
    (i) => i.merge_source === "url_only_new_item" && i.image_url
  ).length;

  logger.info("[HYBRID/MERGE] 📷 IMAGE FLOW ANALYSIS:", {
    urlTotalImages: urlItemsWithImages,
    finalTotalImages: mergedWithImages,
    imagesLost: urlItemsWithImages - mergedWithImages,
    pdfEnhancedWithImages,
    urlOnlyWithImages,
    pdfOnlyWithImages: merged.filter((i) => i.merge_source === "pdf_only" && i.image_url).length,
  });

  // FINAL DEDUPLICATION PASS
  const dedupeResult = deduplicateMergedItems(merged);

  if (dedupeResult.duplicatesRemoved > 0) {
    logger.info("[HYBRID/MERGE] ✅ Deduplication removed duplicates", {
      removed: dedupeResult.duplicatesRemoved,
      beforeCount: merged.length,
      afterCount: dedupeResult.deduplicated.length,
    });
  } else {

    // Block handled

  }

  return dedupeResult.deduplicated;
}

/**
 * DEDUPLICATION: Remove duplicate items from merged results
 * Keeps the first occurrence (prefer PDF items over URL items)
 */
function deduplicateMergedItems(items: MenuItem[]): {
  deduplicated: MenuItem[];
  duplicatesRemoved: number;
  duplicatePairs: Array<{ kept: string; removed: string; reason: string }>;
} {
  logger.info("[HYBRID/DEDUPE] Starting deduplication pass", {
    totalItems: items.length,
  });

  const kept: MenuItem[] = [];
  const duplicatePairs: Array<{ kept: string; removed: string; reason: string }> = [];
  let duplicatesRemoved = 0;

  for (const item of items) {
    // Check if this item is a duplicate of any kept item
    let isDuplicate = false;

    for (const keptItem of kept) {
      // Use same matching logic as main merge
      const matchResult = findBestMatchForDedupe(item, keptItem);

      if (matchResult.isDuplicate) {
        isDuplicate = true;
        duplicatesRemoved++;
        duplicatePairs.push({
          kept: keptItem.name,
          removed: item.name,
          reason: matchResult.reason,
        });

        // Log first few duplicates
        if (duplicatesRemoved <= 5) {
          logger.info("[HYBRID/DEDUPE] 🗑️ Duplicate removed", {
            kept: keptItem.name,
            removed: item.name,
            keptSource: keptItem.merge_source,
            removedSource: item.merge_source,
            reason: matchResult.reason,
          });
        }
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(item);
    }
  }

  logger.info("[HYBRID/DEDUPE] Deduplication complete", {
    originalCount: items.length,
    finalCount: kept.length,
    duplicatesRemoved,
  });

  if (duplicatesRemoved > 5) {
    logger.info("[HYBRID/DEDUPE] Sample duplicates (first 5):", {
      samples: duplicatePairs.slice(0, 5),
    });
  }

  return {
    deduplicated: kept,
    duplicatesRemoved,
    duplicatePairs,
  };
}

/**
 * Simplified matching for deduplication (faster, stricter)
 */
function findBestMatchForDedupe(item1: MenuItem, item2: MenuItem): { isDuplicate: boolean; reason: string } {
  const name1 = normalizeName(item1.name);
  const name2 = normalizeName(item2.name);

  // Exact match
  if (name1 === name2) {
    return { isDuplicate: true, reason: "exact_match" };
  }

  // Very high similarity threshold for deduplication (more conservative)
  const tokens1 = name1.split(" ").filter((t) => t.length > 1);
  const tokens2 = name2.split(" ").filter((t) => t.length > 1);

  if (tokens1.length > 0 && tokens2.length > 0) {
    const matchedTokens = tokens1.filter((t) => tokens2.includes(t)).length;
    const maxTokens = Math.max(tokens1.length, tokens2.length);
    const tokenOverlap = matchedTokens / maxTokens;

    // Price check (if both have prices and they match, more likely duplicate)
    const priceMatch = item1.price && item2.price && Math.abs(item1.price - item2.price) <= 0.5;

    // High threshold: 90% token overlap OR 80% overlap + price match
    if (tokenOverlap >= 0.9) {
      return { isDuplicate: true, reason: "high_token_overlap" };
    } else if (tokenOverlap >= 0.8 && priceMatch) {
      return { isDuplicate: true, reason: "token_overlap_price_match" };
    }
  }

  return { isDuplicate: false, reason: "no_match" };
}

/**
 * Calculate string similarity (kept for backwards compatibility)
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
