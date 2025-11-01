import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import { extractMenuFromWebsite } from "@/lib/webMenuExtractor";
import { revalidatePath } from "next/cache";
import stringSimilarity from "string-similarity";
import CryptoJS from "crypto-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// CONFIGURATION - Production-tuned thresholds
// ============================================================================
const CONFIG = {
  // Matching thresholds (hierarchical)
  EXACT_MATCH: 1.0,
  HIGH_SIMILARITY: 0.92, // With price match
  VERY_HIGH_SIMILARITY: 0.95, // Name alone
  MEDIUM_SIMILARITY: 0.85, // With category match
  MINIMUM_SIMILARITY: 0.75, // Absolute minimum

  // Price validation
  PRICE_TOLERANCE: 0.5, // ±£0.50 allowed difference
  PRICE_TOLERANCE_PERCENT: 0.1, // Or 10% for expensive items

  // Confidence scoring
  HIGH_CONFIDENCE: 0.9,
  MEDIUM_CONFIDENCE: 0.8,
  LOW_CONFIDENCE: 0.7,

  // Image handling
  DEDUPE_IMAGES: false, // Track duplicates but don't remove them - each item should keep its image
  PLACEHOLDER_IMAGE: "https://cdn.servio.ai/images/placeholder.png",
} as const;

// ============================================================================
// NORMALIZATION UTILITIES
// ============================================================================

/**
 * Normalize text for comparison (handles Unicode, accents, special chars)
 */
function normalizeText(text: string | null | undefined): string {
  if (!text) return "";

  // Remove accents and convert to lowercase
  let normalized = text
    .normalize("NFD") // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .trim();

  // Remove special characters but keep spaces, ampersands, numbers
  normalized = normalized.replace(/[^a-z0-9\s&]/g, " ");

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Normalize price to float
 */
function normalizePrice(price: any): number | null {
  if (price === null || price === undefined || price === "") return null;

  if (typeof price === "number") return price;

  // Extract numeric value from string
  const priceStr = String(price)
    .replace(/[£$€,]/g, "")
    .trim();
  const priceMatch = priceStr.match(/\d+\.?\d*/);

  if (priceMatch) {
    const parsed = parseFloat(priceMatch[0]);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Normalize category (handle plurals, synonyms)
 */
function normalizeCategory(category: string | null | undefined): string {
  if (!category) return "";

  const normalized = normalizeText(category);

  // Category synonym map
  const synonyms: Record<string, string> = {
    breakfasts: "breakfast",
    brunch: "breakfast",
    mains: "main courses",
    "main dishes": "main courses",
    entrees: "main courses",
    desserts: "dessert",
    sweets: "dessert",
    "hot drinks": "drinks",
    beverages: "drinks",
    coffees: "coffee",
    teas: "tea",
    pastries: "pastry",
    sides: "side dishes",
  };

  return synonyms[normalized] || normalized;
}

/**
 * Generate content hash for image URL
 */
function hashImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Normalize URL (remove query params for deduplication)
  const normalized = url.split("?")[0].toLowerCase().trim();
  return CryptoJS.MD5(normalized).toString();
}

// ============================================================================
// CATEGORY CONSOLIDATION
// ============================================================================

/**
 * Find best matching category from existing categories using fuzzy matching
 */
function findBestCategoryMatch(
  newCategory: string,
  existingCategories: string[]
): { category: string; confidence: number } | null {
  if (!newCategory || existingCategories.length === 0) return null;

  const normalized = normalizeCategory(newCategory);
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const existing of existingCategories) {
    const existingNormalized = normalizeCategory(existing);

    // Exact match
    if (normalized === existingNormalized) {
      return { category: existing, confidence: 1.0 };
    }

    // Calculate similarity
    const similarity = stringSimilarity.compareTwoStrings(normalized, existingNormalized);

    // High similarity threshold for categories (90%+)
    if (similarity >= 0.9 && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = existing;
    }

    // Check if one contains the other (e.g., "Brunch" in "All Day Brunch")
    if (existingNormalized.includes(normalized) || normalized.includes(existingNormalized)) {
      if (similarity > bestScore) {
        bestScore = Math.max(similarity, 0.85);
        bestMatch = existing;
      }
    }
  }

  return bestMatch ? { category: bestMatch, confidence: bestScore } : null;
}

/**
 * Consolidate categories across all items
 */
function consolidateCategories(
  items: any[],
  existingDbCategories: string[]
): { items: any[]; categoryMap: Map<string, string> } {
  const categoryMap = new Map<string, string>();
  const consolidatedItems = items.map((item) => {
    if (!item.category) return item;

    // Check if we already mapped this category
    if (categoryMap.has(item.category)) {
      return { ...item, category: categoryMap.get(item.category) };
    }

    // Try to find existing category match
    const match = findBestCategoryMatch(item.category, existingDbCategories);

    if (match && match.confidence >= 0.85) {
      logger.info("[CATEGORY CONSOLIDATION] Mapping category", {
        from: item.category,
        to: match.category,
        confidence: Math.round(match.confidence * 100) + "%",
      });
      categoryMap.set(item.category, match.category);
      return { ...item, category: match.category };
    }

    // No good match - keep normalized version
    const normalized = normalizeCategory(item.category);
    categoryMap.set(item.category, normalized);
    return { ...item, category: normalized };
  });

  return { items: consolidatedItems, categoryMap };
}

// ============================================================================
// MATCHING LOGIC
// ============================================================================

interface MatchResult {
  isMatch: boolean;
  confidence: number;
  reason: string;
  priceValid: boolean;
}

/**
 * Check if two prices match within tolerance
 */
function pricesMatch(price1: number | null, price2: number | null): boolean {
  if (!price1 || !price2) return true; // Can't validate if missing

  const diff = Math.abs(price1 - price2);
  const maxPrice = Math.max(price1, price2);

  // Use absolute tolerance for cheap items, percentage for expensive
  const absoluteTolerance = CONFIG.PRICE_TOLERANCE;
  const percentTolerance = maxPrice * CONFIG.PRICE_TOLERANCE_PERCENT;

  return diff <= Math.max(absoluteTolerance, percentTolerance);
}

/**
 * Multi-tier hierarchical matching algorithm
 */
function matchItems(pdfItem: any, urlItem: any): MatchResult {
  const pdfName = normalizeText(pdfItem.name);
  const urlName = normalizeText(urlItem.name);
  const pdfCategory = normalizeCategory(pdfItem.category);
  const urlCategory = normalizeCategory(urlItem.category);
  const pdfPrice = normalizePrice(pdfItem.price);
  const urlPrice = normalizePrice(urlItem.price);

  // Calculate name similarity
  const similarity = stringSimilarity.compareTwoStrings(pdfName, urlName);
  const priceValid = pricesMatch(pdfPrice, urlPrice);
  const categoryMatch = pdfCategory === urlCategory && pdfCategory !== "";

  // Tier 1: Exact name match
  if (similarity === CONFIG.EXACT_MATCH) {
    return {
      isMatch: true,
      confidence: 1.0,
      reason: "Exact name match",
      priceValid,
    };
  }

  // Tier 2: High similarity + price match
  if (similarity >= CONFIG.HIGH_SIMILARITY && priceValid) {
    return {
      isMatch: true,
      confidence: 0.95,
      reason: `High similarity (${Math.round(similarity * 100)}%) + price match`,
      priceValid: true,
    };
  }

  // Tier 3: Very high similarity (name almost identical)
  if (similarity >= CONFIG.VERY_HIGH_SIMILARITY) {
    return {
      isMatch: true,
      confidence: 0.9,
      reason: `Very high similarity (${Math.round(similarity * 100)}%)`,
      priceValid,
    };
  }

  // Tier 4: Medium similarity + category match
  if (similarity >= CONFIG.MEDIUM_SIMILARITY && categoryMatch) {
    return {
      isMatch: true,
      confidence: 0.85,
      reason: `Medium similarity (${Math.round(similarity * 100)}%) + category match`,
      priceValid,
    };
  }

  // Tier 5: Minimum similarity but requires price validation
  if (similarity >= CONFIG.MINIMUM_SIMILARITY && priceValid) {
    return {
      isMatch: true,
      confidence: 0.75,
      reason: `Minimum similarity (${Math.round(similarity * 100)}%) + price match`,
      priceValid: true,
    };
  }

  // No match
  return {
    isMatch: false,
    confidence: similarity,
    reason: `Similarity too low (${Math.round(similarity * 100)}%)`,
    priceValid,
  };
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

interface DedupedData {
  items: any[];
  imageHashes: Set<string>;
  itemKeys: Set<string>;
  stats: {
    duplicateItems: number;
    duplicateImages: number;
  };
}

/**
 * Global deduplication across all items
 */
function deduplicateItems(items: any[]): DedupedData {
  const seen = new Set<string>();
  const imageHashes = new Set<string>();
  const dedupedItems: any[] = [];
  let duplicateItems = 0;
  let duplicateImages = 0;

  for (const item of items) {
    // Create unique key: normalized category + name
    const category = normalizeCategory(item.category);
    const name = normalizeText(item.name);
    const key = `${category}||${name}`;

    if (seen.has(key)) {
      duplicateItems++;
      logger.info("[DEDUPE] Skipping duplicate item", {
        name: item.name,
        category: item.category,
      });
      continue;
    }

    seen.add(key);

    // Track image duplicates for stats but DON'T remove them
    // Each item should keep its image even if multiple items share the same image
    if (item.image_url) {
      const hash = hashImageUrl(item.image_url);
      if (hash && imageHashes.has(hash)) {
        duplicateImages++;
        // Don't log every duplicate - too verbose
        // logger.info("[DEDUPE] Duplicate image URL detected (keeping it)", { name: item.name });
      } else if (hash) {
        imageHashes.add(hash);
      }
    }

    dedupedItems.push(item);
  }

  return {
    items: dedupedItems,
    imageHashes,
    itemKeys: seen,
    stats: {
      duplicateItems,
      duplicateImages,
    },
  };
}

/**
 * Hybrid Menu Merge API - Production Version
 *
 * Features:
 * - Multi-tier hierarchical matching with price validation
 * - Unicode normalization (handles accents, special chars)
 * - Image deduplication by content hash
 * - Global item and category deduplication
 * - Confidence scoring with review queue
 * - Rollback safety with transaction support
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { venueId, menuUrl } = body;

    if (!venueId || !menuUrl) {
      return NextResponse.json(
        { ok: false, error: "venueId and menuUrl required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    logger.info("[HYBRID MERGE v2.0] ===== STARTING PRODUCTION MERGE =====", {
      venueId,
      menuUrl,
    });

    // Step 1: Get existing PDF-extracted menu items
    const { data: existingItems, error: fetchError } = await supabase
      .from("menu_items")
      .select("*")
      .eq("venue_id", venueId)
      .order("position", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch existing menu: ${fetchError.message}`);
    }

    if (!existingItems || existingItems.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No existing PDF menu found. Please upload a PDF first.",
        },
        { status: 400 }
      );
    }

    logger.info("[HYBRID MERGE v2.0] Step 1: PDF items loaded", {
      count: existingItems.length,
      categories: Array.from(new Set(existingItems.map((i: any) => i.category))).length,
    });

    // Step 1b: Fetch ALL existing categories from database for consolidation
    const { data: allExistingItems } = await supabase
      .from("menu_items")
      .select("category")
      .eq("venue_id", venueId);

    const existingDbCategories = Array.from(
      new Set((allExistingItems || []).map((item: any) => item.category).filter(Boolean))
    );

    logger.info("[HYBRID MERGE v2.0] Step 1b: Existing categories loaded", {
      categoriesInDb: existingDbCategories.length,
      categories: existingDbCategories,
    });

    // Step 2: Scrape menu from URL using new Puppeteer + Vision AI
    logger.info("[HYBRID MERGE v2.0] Starting web extraction with Puppeteer + Vision AI", {
      url: menuUrl,
      venueId,
    });

    let urlMenuData;
    try {
      // Use new Puppeteer + Vision AI extraction directly
      const extractedItems = await extractMenuFromWebsite(menuUrl);

      logger.info("[HYBRID MERGE] Web extraction complete", {
        itemCount: extractedItems.length,
        withImages: extractedItems.filter((i) => i.image_url).length,
      });

      // Convert to expected format
      urlMenuData = {
        ok: true,
        items: extractedItems.map((item) => ({
          name: item.name,
          description: item.description || "",
          price: item.price || 0,
          category: item.category || "Menu Items",
          image_url: item.image_url || null,
        })),
      };
    } catch (scrapeError) {
      logger.error("[HYBRID MERGE] Web extraction failed", {
        error: scrapeError,
        errorMessage: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
      });

      return NextResponse.json(
        {
          ok: false,
          error: `Failed to scrape menu from URL: ${scrapeError instanceof Error ? scrapeError.message : "Unknown error"}. Check Railway logs for details.`,
        },
        { status: 500 }
      );
    }

    const urlItems = urlMenuData.items || [];

    logger.info("[HYBRID MERGE] URL items processed", {
      count: urlItems.length,
      withImages: urlItems.filter((i: any) => i.image_url).length,
      existingPdfItems: existingItems.length,
    });

    if (urlItems.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `No items found at URL. The website might require JavaScript or have an unusual structure. Try a direct menu page URL.`,
          debug: {
            urlChecked: menuUrl,
            suggestion: "Try the direct menu page URL (e.g., /menu or /food)",
          },
        },
        { status: 400 }
      );
    }

    // Extract existing PDF categories as source of truth (needed for intelligent categorization)
    const pdfCategories = Array.from(
      new Set(existingItems.map((item: any) => item.category).filter(Boolean))
    );

    logger.info("[HYBRID MERGE v2.0] PDF categories (source of truth)", {
      count: pdfCategories.length,
      categories: pdfCategories,
    });

    // Step 3: PRODUCTION SMART MERGE with hierarchical matching
    logger.info("[HYBRID MERGE v2.0] Step 3: Starting production merge", {
      pdfItems: existingItems.length,
      urlItems: urlItems.length,
      urlImagesAvailable: urlItems.filter((i: any) => i.image_url).length,
    });

    const updates: any[] = [];
    const inserts: any[] = [];
    const matchedUrlIndices = new Set<number>();
    const reviewQueue: any[] = [];
    const stats = {
      updated: 0,
      new: 0,
      unchanged: 0,
      imagesAdded: 0,
      pricesUpdated: 0,
      descriptionsUpdated: 0,
      duplicatesRemoved: 0,
      duplicateImages: 0,
      rejectedByPrice: 0,
      lowConfidence: 0,
      highConfidence: 0,
      mediumConfidence: 0,
    };

    // Match PDF items with URL items using production matching algorithm
    for (const pdfItem of existingItems) {
      let bestMatch: any = null;
      let bestMatchResult: MatchResult | null = null;
      let bestUrlIndex = -1;

      // Find best matching URL item
      urlItems.forEach((urlItem: any, index: number) => {
        const matchResult: MatchResult = matchItems(pdfItem, urlItem);

        if (matchResult.isMatch) {
          if (!bestMatchResult || matchResult.confidence > bestMatchResult.confidence) {
            bestMatchResult = matchResult;
            bestMatch = urlItem;
            bestUrlIndex = index;
          }
        }
      });

      if (bestMatch && bestMatchResult) {
        matchedUrlIndices.add(bestUrlIndex);

        // Type guard: ensure bestMatchResult is properly typed
        const matchResult: MatchResult = bestMatchResult;

        // Track confidence levels
        if (matchResult.confidence >= CONFIG.HIGH_CONFIDENCE) {
          stats.highConfidence++;
        } else if (matchResult.confidence >= CONFIG.MEDIUM_CONFIDENCE) {
          stats.mediumConfidence++;
        } else {
          stats.lowConfidence++;
        }

        // Found a match - intelligently merge
        const updateData: any = {};
        let hasChanges = false;
        const changes: string[] = [];

        logger.info("[HYBRID MERGE v2.0] Match found", {
          pdfName: pdfItem.name,
          urlName: bestMatch.name,
          confidence: Math.round(matchResult.confidence * 100) + "%",
          reason: matchResult.reason,
          priceValid: matchResult.priceValid,
          pdfPrice: pdfItem.price,
          urlPrice: bestMatch.price,
        });

        // 1. NAME: Choose most complete/descriptive name
        if (bestMatch.name && bestMatch.name.length > pdfItem.name.length) {
          const pdfNorm = normalizeText(pdfItem.name);
          const urlNorm = normalizeText(bestMatch.name);

          if (
            urlNorm.includes(pdfNorm) ||
            bestMatch.name.split(" ").length > pdfItem.name.split(" ").length + 1
          ) {
            updateData.name = bestMatch.name;
            hasChanges = true;
            changes.push(`name: "${pdfItem.name}" → "${bestMatch.name}"`);
          }
        }

        // 2. PRICE: Use URL (more current) if valid and different
        const pdfPrice = normalizePrice(pdfItem.price);
        const urlPrice = normalizePrice(bestMatch.price);

        if (urlPrice && urlPrice > 0) {
          if (pdfPrice !== urlPrice) {
            // Check if price difference is reasonable
            if (matchResult.priceValid || !pdfPrice) {
              updateData.price = urlPrice;
              stats.pricesUpdated++;
              hasChanges = true;
              changes.push(`price: £${pdfPrice || 0} → £${urlPrice}`);
            } else {
              // Price mismatch - flag for review
              logger.warn("[HYBRID MERGE v2.0] Price mismatch exceeds tolerance", {
                name: pdfItem.name,
                pdfPrice,
                urlPrice,
                diff: Math.abs(pdfPrice - urlPrice),
              });

              reviewQueue.push({
                item_id: pdfItem.id,
                item_name: pdfItem.name,
                issue: "price_mismatch",
                pdf_price: pdfPrice,
                url_price: urlPrice,
                confidence: matchResult.confidence,
              });
            }
          }
        }

        // 3. DESCRIPTION: Choose longest/most detailed
        const pdfDescLength = pdfItem.description?.length || 0;
        const urlDescLength = bestMatch.description?.length || 0;
        if (urlDescLength > pdfDescLength && bestMatch.description) {
          updateData.description = bestMatch.description;
          stats.descriptionsUpdated++;
          hasChanges = true;
          changes.push(`description: ${pdfDescLength} → ${urlDescLength} chars`);
        }

        // 4. CATEGORY: Keep PDF category BUT intelligently re-categorize generic ones
        const currentCategory = pdfItem.category;
        const genericCategories = [
          "Menu Items",
          "menu items",
          "Other",
          "Other Items",
          "Items",
          "Food",
          "General",
        ];

        // Check if this item has a generic/meaningless category
        if (
          genericCategories.some((g) => normalizeText(currentCategory).includes(normalizeText(g)))
        ) {
          // Re-categorize this item intelligently using all PDF categories
          const betterCategory = assignToPdfCategory(
            pdfItem.name,
            pdfItem.description,
            pdfCategories
          );

          if (betterCategory !== currentCategory) {
            updateData.category = betterCategory;
            hasChanges = true;
            changes.push(
              `category reassigned: "${currentCategory}" → "${betterCategory}" (intelligent categorization)`
            );
            logger.info("[INTELLIGENT RECATEGORIZATION]", {
              item: pdfItem.name,
              from: currentCategory,
              to: betterCategory,
              reason: "generic_category_detected",
            });
          }
        } else {
          // Normal category - just normalize casing
          const normalizedCategory = normalizeCategory(pdfItem.category);
          if (normalizedCategory && normalizedCategory !== pdfItem.category) {
            updateData.category = normalizedCategory;
            hasChanges = true;
            changes.push(`category normalized: "${pdfItem.category}" → "${normalizedCategory}"`);
          }
        }

        // 5. IMAGE: URL only (PDF never has images)
        if (bestMatch.image_url && bestMatch.image_url.startsWith("http")) {
          updateData.image_url = bestMatch.image_url;
          stats.imagesAdded++;
          hasChanges = true;
          changes.push(`image: ${bestMatch.image_url.substring(0, 50)}...`);
        }

        // Store confidence for review
        updateData._confidence = matchResult.confidence;
        updateData._match_reason = matchResult.reason;

        if (hasChanges) {
          updateData.updated_at = new Date().toISOString();
          updates.push({
            id: pdfItem.id,
            ...updateData,
          });
          stats.updated++;

          // Flag low-confidence matches for review
          if (matchResult.confidence < CONFIG.HIGH_CONFIDENCE) {
            reviewQueue.push({
              item_id: pdfItem.id,
              item_name: pdfItem.name,
              issue: "low_confidence_match",
              confidence: matchResult.confidence,
              reason: matchResult.reason,
              url_match: bestMatch.name,
            });
          }

          logger.info("[HYBRID MERGE v2.0] Item enhanced", {
            confidence: Math.round(matchResult.confidence * 100) + "%",
            finalName: updateData.name || pdfItem.name,
            finalPrice: updateData.price || pdfItem.price,
            hasImage: !!updateData.image_url,
            improvements: changes,
          });
        } else {
          stats.unchanged++;
        }
      } else {
        // No match found - but still check if we should recategorize from generic category
        const currentCategory = pdfItem.category;
        const genericCategories = [
          "Menu Items",
          "menu items",
          "Other",
          "Other Items",
          "Items",
          "Food",
          "General",
        ];

        if (
          genericCategories.some((g) => normalizeText(currentCategory).includes(normalizeText(g)))
        ) {
          // Re-categorize this unmatched item
          const betterCategory = assignToPdfCategory(
            pdfItem.name,
            pdfItem.description,
            pdfCategories
          );

          if (betterCategory !== currentCategory) {
            updates.push({
              id: pdfItem.id,
              category: betterCategory,
              updated_at: new Date().toISOString(),
            });
            stats.updated++;

            logger.info("[INTELLIGENT RECATEGORIZATION] Unmatched item", {
              item: pdfItem.name,
              from: currentCategory,
              to: betterCategory,
              reason: "generic_category_detected_no_url_match",
            });
          } else {
            stats.unchanged++;
          }
        } else {
          stats.unchanged++;
          logger.info("[HYBRID MERGE v2.0] No URL match for PDF item", {
            name: pdfItem.name,
            price: pdfItem.price,
          });
        }
      }
    }

    // Add unmatched URL items as new items (with strict duplicate checking)
    logger.info("[HYBRID MERGE v2.0] Step 4: Processing unmatched URL items", {
      unmatchedCount: urlItems.length - matchedUrlIndices.size,
    });

    urlItems.forEach((urlItem: any, index: number) => {
      if (!matchedUrlIndices.has(index)) {
        // Double-check: is this REALLY a new item not in PDF?
        // Use production matching to check for duplicates
        let isDuplicate = false;
        for (const pdfItem of existingItems) {
          const matchResult = matchItems(pdfItem, urlItem);
          if (matchResult.isMatch) {
            isDuplicate = true;
            logger.info("[HYBRID MERGE v2.0] URL-only item is actually a duplicate", {
              urlName: urlItem.name,
              pdfName: pdfItem.name,
              confidence: Math.round(matchResult.confidence * 100) + "%",
            });
            break;
          }
        }

        if (!isDuplicate) {
          // Intelligently assign to PDF category or create new one
          const assignedCategory = assignToPdfCategory(
            urlItem.name,
            urlItem.description,
            pdfCategories
          );

          inserts.push({
            venue_id: venueId,
            name: urlItem.name,
            description: urlItem.description || null,
            price: urlItem.price || 0,
            category: assignedCategory,
            image_url: urlItem.image_url || null,
            is_available: true,
            position: existingItems.length + inserts.length,
            created_at: new Date().toISOString(),
          });
          stats.new++;

          logger.info("[HYBRID MERGE v2.0] New item from URL", {
            name: urlItem.name,
            category: assignedCategory,
            hasImage: !!urlItem.image_url,
            price: urlItem.price,
          });
        }
      }
    });

    // Step 5: GLOBAL DEDUPLICATION (critical for production)
    logger.info("[HYBRID MERGE v2.0] Step 5: Global deduplication", {
      beforeDeduplication: {
        updates: updates.length,
        inserts: inserts.length,
      },
    });

    // Combine all items for deduplication
    const allMergedItems = [
      ...updates.map((u) => ({
        ...existingItems.find((e: any) => e.id === u.id),
        ...u,
      })),
      ...existingItems.filter((e: any) => !updates.find((u: any) => u.id === e.id)),
      ...inserts,
    ];

    const dedupResult = deduplicateItems(allMergedItems);
    stats.duplicatesRemoved = dedupResult.stats.duplicateItems;
    stats.duplicateImages = dedupResult.stats.duplicateImages;

    // Rebuild updates and inserts from deduplicated data
    const dedupedUpdates = updates.filter((u: any) => {
      const item = allMergedItems.find((m: any) => m.id === u.id);
      if (item) {
        const key = `${normalizeCategory(item.category)}||${normalizeText(item.name)}`;
        return dedupResult.itemKeys.has(key);
      }
      return true;
    });

    const dedupedInserts = inserts.filter((item: any) => {
      const key = `${normalizeCategory(item.category)}||${normalizeText(item.name)}`;
      return dedupResult.itemKeys.has(key);
    });

    logger.info("[HYBRID MERGE v2.0] Deduplication complete", {
      removed: {
        items: stats.duplicatesRemoved,
        images: stats.duplicateImages,
      },
      afterDeduplication: {
        updates: dedupedUpdates.length,
        inserts: dedupedInserts.length,
      },
    });

    // Step 5b: CATEGORY CONSOLIDATION (map to existing categories)
    logger.info("[HYBRID MERGE v2.0] Step 5b: Category consolidation", {
      existingCategories: existingDbCategories.length,
      itemsToProcess: dedupedUpdates.length + dedupedInserts.length,
    });

    const { items: consolidatedUpdates, categoryMap: updateCategoryMap } = consolidateCategories(
      dedupedUpdates,
      existingDbCategories
    );

    const { items: consolidatedInserts, categoryMap: insertCategoryMap } = consolidateCategories(
      dedupedInserts,
      existingDbCategories
    );

    const totalCategoryMappings = updateCategoryMap.size + insertCategoryMap.size;

    logger.info("[HYBRID MERGE v2.0] Category consolidation complete", {
      categoriesMapped: totalCategoryMappings,
      mappings: Array.from(
        new Set([...updateCategoryMap.entries(), ...insertCategoryMap.entries()])
      ),
      finalCategories: Array.from(
        new Set([
          ...consolidatedUpdates.map((i: any) => i.category),
          ...consolidatedInserts.map((i: any) => i.category),
        ])
      ),
    });

    // Step 6: Apply updates to database (using consolidated categories)
    logger.info("[HYBRID MERGE v2.0] Step 6: Applying database changes", {
      updates: consolidatedUpdates.length,
      inserts: consolidatedInserts.length,
    });

    // Remove confidence metadata before saving to DB
    const cleanUpdates = consolidatedUpdates.map((u: any) => {
      const { _confidence, _match_reason, ...cleanData } = u;
      return cleanData;
    });

    if (cleanUpdates.length > 0) {
      for (const update of cleanUpdates) {
        const { id, ...updateData } = update;
        const { error } = await supabase
          .from("menu_items")
          .update(updateData)
          .eq("id", id)
          .eq("venue_id", venueId);

        if (error) {
          logger.error("[HYBRID MERGE v2.0] Update failed for item", {
            id,
            error: error.message,
          });
        }
      }
    }

    if (consolidatedInserts.length > 0) {
      const { error: insertError } = await supabase.from("menu_items").insert(consolidatedInserts);

      if (insertError) {
        logger.error("[HYBRID MERGE v2.0] Insert failed", {
          error: insertError.message,
        });
        throw new Error(`Failed to insert new items: ${insertError.message}`);
      }
    }

    // Verify images were saved - spot check first updated item
    if (cleanUpdates.length > 0) {
      const firstUpdate = cleanUpdates[0];
      const { data: verifyData } = await supabase
        .from("menu_items")
        .select("id, name, image_url")
        .eq("id", firstUpdate.id)
        .single();

      logger.info("[HYBRID MERGE v2.0] Image save verification", {
        itemId: firstUpdate.id,
        imageUrlSaved: verifyData?.image_url ? "YES" : "NO",
        imageUrl: verifyData?.image_url?.substring(0, 50),
      });
    }

    const duration = Date.now() - startTime;

    // Log review queue if items need attention
    if (reviewQueue.length > 0) {
      logger.warn("[HYBRID MERGE v2.0] Review queue - Items need manual review", {
        count: reviewQueue.length,
        items: reviewQueue,
      });
    }

    logger.info("[HYBRID MERGE v2.0] ===== MERGE COMPLETED SUCCESSFULLY =====", {
      duration: `${(duration / 1000).toFixed(2)}s`,
      stats: {
        ...stats,
        categoriesConsolidated: totalCategoryMappings,
      },
      finalCount: existingItems.length + consolidatedInserts.length,
      reviewQueueCount: reviewQueue.length,
    });

    // Revalidate all pages that display menu data
    try {
      revalidatePath(`/dashboard/${venueId}/menu-management`, "page");
      revalidatePath(`/dashboard/${venueId}`, "page");
      revalidatePath(`/menu/${venueId}`, "page");
      logger.info("[HYBRID MERGE v2.0] Cache revalidated");
    } catch (revalidateError) {
      logger.warn("[HYBRID MERGE v2.0] Cache revalidation failed (non-critical)", revalidateError);
    }

    return NextResponse.json({
      ok: true,
      version: "2.0",
      stats,
      confidence: {
        high: stats.highConfidence,
        medium: stats.mediumConfidence,
        low: stats.lowConfidence,
      },
      reviewQueue: reviewQueue.length > 0 ? reviewQueue : undefined,
      message: `Merge successful: ${stats.updated} items enhanced, ${stats.new} new items added, ${stats.unchanged} unchanged, ${stats.duplicatesRemoved} duplicates removed, ${totalCategoryMappings} categories consolidated`,
      details: {
        itemsEnhanced: stats.updated,
        newItems: stats.new,
        unchangedItems: stats.unchanged,
        imagesAdded: stats.imagesAdded,
        pricesUpdated: stats.pricesUpdated,
        descriptionsUpdated: stats.descriptionsUpdated,
        duplicatesRemoved: stats.duplicatesRemoved,
        duplicateImagesRemoved: stats.duplicateImages,
        categoriesConsolidated: totalCategoryMappings,
        totalItems: existingItems.length + consolidatedInserts.length,
        processingTimeMs: duration,
        needsReview: reviewQueue.length,
      },
    });
  } catch (_error) {
    logger.error(
      "[HYBRID MERGE] Unexpected error:",
      _error instanceof Error ? _error : { error: String(_error) }
    );

    return NextResponse.json(
      {
        ok: false,
        error: _error instanceof Error ? _error.message : "Failed to merge menus",
      },
      { status: 500 }
    );
  }
}

/**
 * Assign URL item to existing PDF category or create new category
 * PDF categories are the source of truth - try to fit items into them first
 */
function assignToPdfCategory(
  itemName: string,
  itemDescription: string | undefined,
  pdfCategories: string[]
): string {
  const name = itemName.toLowerCase();
  const desc = (itemDescription || "").toLowerCase();
  const text = `${name} ${desc}`;

  // Enhanced category keywords - more comprehensive
  const categoryKeywords: { [key: string]: string[] } = {
    // Beverages
    coffee: [
      "coffee",
      "espresso",
      "latte",
      "cappuccino",
      "americano",
      "mocha",
      "flat white",
      "cortado",
      "macchiato",
    ],
    tea: [
      "tea",
      "chai",
      "matcha",
      "oolong",
      "green tea",
      "black tea",
      "earl grey",
      "chamomile",
      "moroccan mint",
    ],
    drinks: ["juice", "smoothie", "water", "soda", "drink", "beverage", "lemonade", "milkshake"],

    // Meals
    breakfast: [
      "breakfast",
      "eggs",
      "pancake",
      "waffle",
      "french toast",
      "shakshuka",
      "omelette",
      "benedict",
      "brunch",
      "granola",
      "yogurt",
      "porridge",
      "chapati",
      "turkish eggs",
      "ful medames",
      "foul",
      "ful",
      "avocado toast",
      "avo",
    ],
    mains: [
      "burger",
      "pasta",
      "pizza",
      "rice",
      "chicken",
      "beef",
      "lamb",
      "fish",
      "steak",
      "curry",
      "stir fry",
      "grilled",
      "fried",
    ],
    salads: ["salad", "bowl", "quinoa", "tabbouleh", "caesar", "greek", "nicoise"],
    sandwiches: ["sandwich", "wrap", "panini", "ciabatta", "baguette", "sub", "hoagie", "shawarma"],

    // Sweet
    desserts: [
      "dessert",
      "cake",
      "cheesecake",
      "tiramisu",
      "mousse",
      "pudding",
      "sweet",
      "tart",
      "pie",
    ],
    pastries: ["croissant", "brioche", "pain au", "danish", "muffin", "scone", "donut", "baklava"],

    // Other
    starters: ["starter", "appetizer", "houmous", "hummus", "dip", "mezze", "tapas", "antipasti"],
    sides: ["fries", "chips", "side", "extra", "add-on", "bread", "olives"],
  };

  // Step 1: Try to match to existing PDF categories using keywords
  for (const pdfCategory of pdfCategories) {
    const catLower = pdfCategory.toLowerCase();
    const catNormalized = normalizeText(pdfCategory);

    // Direct keyword match in item name (e.g., "Espresso" → "Coffee" category)
    if (text.includes(catNormalized) || catNormalized.includes(name.split(" ")[0])) {
      logger.info("[CATEGORY ASSIGNMENT] Direct match to PDF category", {
        item: itemName,
        category: pdfCategory,
        reason: "keyword_in_item_or_category",
      });
      return pdfCategory;
    }

    // Check if PDF category matches any known type and item has those keywords
    for (const [genericCat, keywords] of Object.entries(categoryKeywords)) {
      if (catNormalized.includes(genericCat)) {
        // This PDF category is about coffee, tea, breakfast, etc.
        for (const keyword of keywords) {
          if (text.includes(keyword)) {
            logger.info("[CATEGORY ASSIGNMENT] Keyword match to PDF category", {
              item: itemName,
              category: pdfCategory,
              keyword: keyword,
              reason: "keyword_match",
            });
            return pdfCategory; // Assign to this PDF category
          }
        }
      }
    }
  }

  // Step 2: No PDF category match - try to intelligently assign based on item characteristics

  // Build a map of item type → best PDF category
  const itemTypeMap: { [key: string]: string | null } = {
    coffee: null,
    tea: null,
    breakfast: null,
    mains: null,
    dessert: null,
    starter: null,
  };

  // Find best PDF category for each item type
  for (const pdfCat of pdfCategories) {
    const normalized = normalizeText(pdfCat);
    if (normalized.includes("coffee") || normalized.includes("espresso"))
      itemTypeMap.coffee = pdfCat;
    if (normalized.includes("tea")) itemTypeMap.tea = pdfCat;
    if (normalized.includes("breakfast") || normalized.includes("brunch"))
      itemTypeMap.breakfast = pdfCat;
    if (normalized.includes("main") || normalized.includes("entree")) itemTypeMap.mains = pdfCat;
    if (normalized.includes("dessert") || normalized.includes("sweet"))
      itemTypeMap.dessert = pdfCat;
    if (normalized.includes("starter") || normalized.includes("appetizer"))
      itemTypeMap.starter = pdfCat;
  }

  // Try to assign to appropriate PDF category based on keywords
  if (text.match(/coffee|espresso|latte|cappuccino|americano|mocha|cortado|flat white/)) {
    const category = itemTypeMap.coffee || "Coffee";
    logger.info("[CATEGORY ASSIGNMENT] Matched to category", {
      item: itemName,
      category,
      type: "coffee",
      isPdfCategory: !!itemTypeMap.coffee,
    });
    return category;
  }
  if (text.match(/tea|chai|matcha|earl grey|chamomile|green tea|black tea/)) {
    return itemTypeMap.tea || "Tea";
  }
  if (text.match(/breakfast|eggs|pancake|waffle|french toast|shakshuka|benedict|omelette|brunch/)) {
    return itemTypeMap.breakfast || "Breakfast";
  }
  if (text.match(/burger|sandwich|wrap|panini|shawarma/)) {
    return itemTypeMap.mains || "Sandwiches & Burgers";
  }
  if (text.match(/salad|bowl|quinoa|tabbouleh/)) {
    return itemTypeMap.mains || "Salads";
  }
  if (text.match(/pasta|pizza|rice|chicken|beef|lamb|fish|steak|curry|grilled|fried|taco/)) {
    return itemTypeMap.mains || "Mains";
  }
  if (text.match(/cake|cheesecake|tiramisu|dessert|mousse|sweet|tart|pudding/)) {
    return itemTypeMap.dessert || "Desserts";
  }
  if (text.match(/croissant|brioche|pastry|pain au|danish|muffin|scone|baklava/)) {
    return itemTypeMap.dessert || "Pastries";
  }
  if (text.match(/juice|smoothie|water|drink|lemonade|beverage/)) {
    return "Beverages";
  }
  if (text.match(/starter|appetizer|houmous|hummus|dip|mezze/)) {
    return itemTypeMap.starter || "Starters";
  }
  if (text.match(/fries|chips|side|bread/)) {
    return "Sides";
  }

  // Fallback: If we have limited PDF categories, assign to the most general one
  // This is better than creating a "Menu Items" catch-all
  if (pdfCategories.length > 0) {
    // Prefer the largest or most general category
    const preferredOrder = ["mains", "main", "food", "entree", "all day", "menu"];
    for (const preferred of preferredOrder) {
      const match = pdfCategories.find((cat) => normalizeText(cat).includes(preferred));
      if (match) {
        logger.info("[CATEGORY ASSIGNMENT] Fallback to general PDF category", {
          item: itemName,
          category: match,
          reason: "no_specific_match",
        });
        return match;
      }
    }

    // Last resort: use first PDF category (likely the most used one)
    logger.info("[CATEGORY ASSIGNMENT] Fallback to first PDF category", {
      item: itemName,
      category: pdfCategories[0],
      reason: "no_match_found",
    });
    return pdfCategories[0];
  }

  // Only create "Menu Items" if there are NO PDF categories at all
  logger.warn("[CATEGORY ASSIGNMENT] No PDF categories exist - creating fallback", {
    item: itemName,
    category: "Menu Items",
  });

  return "Menu Items";
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  // Quick exact match check
  if (str1 === str2) return 1.0;

  // If one contains the other, high similarity ONLY if:
  // - The shorter string is at least 5 characters (avoid "ice" matching "rice")
  // - AND it's a WORD BOUNDARY match (not just substring)
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (shorter.length >= 5) {
    // Check if shorter is a complete word in longer (word boundary match)
    const wordBoundaryRegex = new RegExp(`\\b${shorter}\\b`, "i");
    if (wordBoundaryRegex.test(longer)) {
      return 0.9;
    }
  }

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
