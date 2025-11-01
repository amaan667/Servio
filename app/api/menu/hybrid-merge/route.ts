import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import { extractMenuFromWebsite } from "@/lib/webMenuExtractor";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Hybrid Menu Merge API
 * Intelligently compares PDF-extracted menu with URL-scraped menu
 * Uses AI to match items and merge data (prices, descriptions, images)
 */
export async function POST(req: NextRequest) {
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

    // Step 2: Scrape menu from URL using new Puppeteer + Vision AI
    logger.info("[HYBRID MERGE] Starting web extraction with Puppeteer + Vision AI", {
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

    // Step 3: Smart merge - combine PDF and URL data to get the best menu
    // PDF: Complete menu structure, item IDs
    // URL: Images, current prices, better descriptions
    logger.info("[HYBRID MERGE] Starting smart merge", {
      pdfItems: existingItems.length,
      urlItems: urlItems.length,
      urlImagesAvailable: urlItems.filter((i: any) => i.image_url).length,
    });

    const updates: any[] = [];
    const inserts: any[] = [];
    const matchedUrlItems = new Set<number>();
    const stats = {
      updated: 0,
      new: 0,
      unchanged: 0,
      imagesAdded: 0,
      pricesUpdated: 0,
      descriptionsUpdated: 0,
    };

    // Match PDF items with URL items
    for (const pdfItem of existingItems) {
      let bestMatch: any = null;
      let bestSimilarity = 0;

      // Find best matching URL item by name
      urlItems.forEach((urlItem: any, index: number) => {
        const similarity = calculateStringSimilarity(
          pdfItem.name.toLowerCase().trim(),
          urlItem.name.toLowerCase().trim()
        );

        if (similarity > bestSimilarity && similarity > 0.75) {
          // 75% similarity threshold - stricter to avoid false matches
          bestSimilarity = similarity;
          bestMatch = { ...urlItem, index };
        }
      });

      if (bestMatch) {
        matchedUrlItems.add(bestMatch.index);

        // Found a match - compare ALL fields and choose the best data
        const updateData: any = {};
        let hasChanges = false;
        const changes: string[] = [];

        // IMAGE: URL always wins (PDF doesn't have images)
        if (bestMatch.image_url && bestMatch.image_url !== pdfItem.image_url) {
          updateData.image_url = bestMatch.image_url;
          stats.imagesAdded++;
          hasChanges = true;
          changes.push("image");
        }

        // PRICE: URL wins (more current/accurate)
        if (bestMatch.price && bestMatch.price > 0 && bestMatch.price !== pdfItem.price) {
          updateData.price = bestMatch.price;
          stats.pricesUpdated++;
          hasChanges = true;
          changes.push(`price: ${pdfItem.price} → ${bestMatch.price}`);
        }

        // DESCRIPTION: Choose longer/better description
        const pdfDescLength = pdfItem.description?.length || 0;
        const urlDescLength = bestMatch.description?.length || 0;
        if (urlDescLength > pdfDescLength && bestMatch.description) {
          updateData.description = bestMatch.description;
          stats.descriptionsUpdated++;
          hasChanges = true;
          changes.push(`description: ${pdfDescLength} → ${urlDescLength} chars`);
        }

        // CATEGORY: Keep PDF category (more reliable) - only update if PDF has none
        if (!pdfItem.category && bestMatch.category && bestMatch.category !== "Menu Items") {
          updateData.category = bestMatch.category;
          hasChanges = true;
          changes.push(`category: added ${bestMatch.category}`);
        }

        // NAME: Keep PDF name (OCR from official menu) - it's more authoritative
        // Only update if PDF name is clearly truncated or missing details
        if (
          bestMatch.name.length > pdfItem.name.length + 10 &&
          bestMatch.name.toLowerCase().includes(pdfItem.name.toLowerCase())
        ) {
          updateData.name = bestMatch.name;
          hasChanges = true;
          changes.push(`name: ${pdfItem.name} → ${bestMatch.name}`);
        }

        if (hasChanges) {
          updateData.updated_at = new Date().toISOString();
          updates.push({
            id: pdfItem.id,
            ...updateData,
          });
          stats.updated++;

          logger.info("[HYBRID MERGE] Enhanced item", {
            originalName: pdfItem.name,
            matchedName: bestMatch.name,
            similarity: Math.round(bestSimilarity * 100) + "%",
            improvements: changes,
          });
        } else {
          stats.unchanged++;
          logger.info("[HYBRID MERGE] Item unchanged (already optimal)", {
            name: pdfItem.name,
          });
        }
      } else {
        // No match found - keep PDF item as-is
        stats.unchanged++;
        logger.info("[HYBRID MERGE] No URL match for PDF item", {
          name: pdfItem.name,
        });
      }
    }

    // Add unmatched URL items as new items (with strict duplicate checking)
    urlItems.forEach((urlItem: any, index: number) => {
      if (!matchedUrlItems.has(index)) {
        // Double-check: is this REALLY a new item not in PDF?
        // Check against all PDF items with lower threshold
        const isDuplicate = existingItems.some((pdfItem: any) => {
          const similarity = calculateStringSimilarity(
            pdfItem.name.toLowerCase().trim(),
            urlItem.name.toLowerCase().trim()
          );
          return similarity > 0.6; // Lower threshold for duplicate detection
        });

        if (!isDuplicate) {
          inserts.push({
            venue_id: venueId,
            name: urlItem.name,
            description: urlItem.description || null,
            price: urlItem.price || 0,
            category: urlItem.category || "Menu Items",
            image_url: urlItem.image_url || null,
            is_available: true,
            position: existingItems.length + inserts.length,
            created_at: new Date().toISOString(),
          });
          stats.new++;

          logger.info("[HYBRID MERGE] New item from URL", {
            name: urlItem.name,
            hasImage: !!urlItem.image_url,
          });
        } else {
          logger.info("[HYBRID MERGE] Skipping duplicate URL item", {
            name: urlItem.name,
          });
        }
      }
    });

    // Apply updates to database
    logger.info("[HYBRID MERGE] Applying database changes", {
      updates: updates.length,
      inserts: inserts.length,
    });

    if (updates.length > 0) {
      for (const update of updates) {
        const { id, ...updateData } = update;
        const { error } = await supabase
          .from("menu_items")
          .update(updateData)
          .eq("id", id)
          .eq("venue_id", venueId);

        if (error) {
          logger.error("[HYBRID MERGE] Update failed for item", {
            id,
            error: error.message,
          });
        }
      }
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("menu_items").insert(inserts);

      if (insertError) {
        logger.error("[HYBRID MERGE] Insert failed", {
          error: insertError.message,
        });
        throw new Error(`Failed to insert new items: ${insertError.message}`);
      }
    }

    // Verify images were saved - spot check first updated item
    if (updates.length > 0) {
      const firstUpdate = updates[0];
      const { data: verifyData } = await supabase
        .from("menu_items")
        .select("id, name, image_url")
        .eq("id", firstUpdate.id)
        .single();

      logger.info("[HYBRID MERGE] Image save verification", {
        itemId: firstUpdate.id,
        imageUrlSaved: verifyData?.image_url ? "YES" : "NO",
        imageUrl: verifyData?.image_url?.substring(0, 50),
      });
    }

    logger.info("[HYBRID MERGE] ===== MERGE COMPLETED SUCCESSFULLY =====", {
      stats,
      finalCount: existingItems.length + inserts.length,
    });

    return NextResponse.json({
      ok: true,
      stats,
      message: `Merge successful: ${stats.updated} items enhanced, ${stats.new} new items added, ${stats.unchanged} unchanged`,
      details: {
        itemsEnhanced: stats.updated,
        newItems: stats.new,
        unchangedItems: stats.unchanged,
        imagesAdded: stats.imagesAdded,
        pricesUpdated: stats.pricesUpdated,
        descriptionsUpdated: stats.descriptionsUpdated,
        totalItems: existingItems.length + inserts.length,
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
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  // Quick exact match check
  if (str1 === str2) return 1.0;

  // If one contains the other, high similarity
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.9;
  }

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

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
