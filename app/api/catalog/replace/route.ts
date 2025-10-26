import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { extractMenuFromImage, extractMenuItemPositions } from "@/lib/gptVisionMenuParser";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for processing

interface ScrapedMenuItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string | null;
}

interface PDFMenuItem {
  name: string;
  description?: string;
  price: number;
  category: string;
  page: number;
}

/**
 * Unified Menu Import: PDF + Optional URL
 * Combines data from both sources for best results
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const venueId = formData.get("venue_id") as string;
    const menuUrl = formData.get("menu_url") as string | null;
    const replaceMode = formData.get("replace_mode") !== "false"; // Default to true

    if (!file || !venueId) {
      return NextResponse.json({ ok: false, error: "file and venue_id required" }, { status: 400 });
    }

    logger.info(`[MENU IMPORT ${requestId}] Starting...`);
    logger.info(`[MENU IMPORT ${requestId}] Venue:`, { venueId });
    logger.info(`[MENU IMPORT ${requestId}] Has URL:`, { hasUrl: !!menuUrl });

    const supabase = createAdminClient();

    // Step 1: Convert PDF to images (serverless-friendly)
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    let pdfImages: string[] = [];
    try {
      const { convertPDFToImages } = await import("@/lib/pdf-to-images-serverless");
      pdfImages = await convertPDFToImages(pdfBuffer);
      logger.info(`[MENU IMPORT ${requestId}] Converted to images:`, { count: pdfImages.length });
    } catch (conversionError) {
      logger.error(`[MENU IMPORT ${requestId}] Conversion error:`, conversionError);
      throw new Error("PDF to image conversion failed - please check Railway logs");
    }

    // Step 2: Store PDF and images in database
    const { error: uploadError } = await supabase
      .from("menu_uploads")
      .insert({
        venue_id: venueId,
        filename: file.name,
        pdf_images: pdfImages,
        status: "processed",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (uploadError) {
      throw new Error(`Failed to save upload: ${uploadError.message}`);
    }

    // Step 3: Extract data from all available sources
    const urlItems: ScrapedMenuItem[] = [];
    const pdfExtractedItems: PDFMenuItem[] = [];
    const pdfPositions: Array<{
      name: string;
      x: number;
      y: number;
      page: number;
      confidence: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }> = [];

    // Extract from URL if provided
    if (menuUrl && menuUrl.trim()) {
      logger.info(`[MENU IMPORT ${requestId}] Extracting from URL...`);
      try {
        // Call the centralized scrape-menu API (Browserless-based)
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          (process.env.RAILWAY_PUBLIC_DOMAIN
            ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
            : "http://localhost:3000");

        // Create AbortController with 120s timeout (Playwright with scrolling can take 60-90s)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        let scrapeResponse;
        try {
          scrapeResponse = await fetch(`${baseUrl}/api/scrape-menu`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: menuUrl }),
            signal: controller.signal,
            // @ts-expect-error - Node.js fetch specific options
            headersTimeout: 120000,
            bodyTimeout: 120000,
          });
          clearTimeout(timeoutId);
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

        if (!scrapeResponse.ok) {
          const errorData = await scrapeResponse.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Scrape API returned ${scrapeResponse.status}`);
        }

        const scrapeResult = (await scrapeResponse.json()) as {
          ok: boolean;
          items?: Array<{
            name: string;
            description?: string;
            price?: number;
            category?: string;
            image?: string;
          }>;
          error?: string;
        };
        if (scrapeResult.ok && scrapeResult.items) {
          urlItems.push(
            ...scrapeResult.items.map((item) => ({
              name: item.name,
              description: item.description || "",
              price: item.price || 0,
              category: item.category || "Menu Items",
              image_url: item.image || null,
            }))
          );
          logger.info(`[MENU IMPORT ${requestId}] URL items:`, { count: urlItems.length });
        } else {
          throw new Error(scrapeResult.error || "Scraping returned no items");
        }
      } catch (_error) {
        logger.warn(`[MENU IMPORT ${requestId}] URL scraping failed, using PDF-only`);
        // Continue with PDF-only extraction
      }
    }

    // Extract from PDF using Vision AI
    logger.info(`[MENU IMPORT ${requestId}] Extracting from PDF with Vision AI...`);
    for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
      // Get item data from Vision
      const extractedItems = await extractMenuFromImage(pdfImages[pageIndex]);
      // Don't add 'page' to items - track it separately
      pdfExtractedItems.push(...extractedItems);

      // Get positions from Vision (now with bounding boxes)
      const positions = await extractMenuItemPositions(pdfImages[pageIndex]);
      positions.forEach(
        (pos: {
          name: string;
          x: number;
          y: number;
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          confidence: number;
        }) => {
          pdfPositions.push({ ...pos, page: pageIndex });
        }
      );

      logger.info(
        `[MENU IMPORT ${requestId}] Page ${pageIndex + 1}: ${extractedItems.length} items, ${positions.length} positions`
      );
    }

    logger.info(`[MENU IMPORT ${requestId}] PDF items:`, { count: pdfExtractedItems.length });
    logger.info(`[MENU IMPORT ${requestId}] PDF positions:`, { count: pdfPositions.length });

    // Step 4: Combine data intelligently
    const menuItems = [];
    const hotspots = [];
    const combinedItems = new Map();
    let itemPosition = 0; // Track insertion order for proper sorting

    // If we have both URL and PDF data, merge them
    if (urlItems.length > 0 && pdfExtractedItems.length > 0) {
      logger.info(`[MENU IMPORT ${requestId}] Combining URL and PDF data...`);

      // Start with URL items (better data quality)
      for (const urlItem of urlItems) {
        const itemId = uuidv4();

        // Find matching PDF item for additional data
        const pdfMatch = pdfExtractedItems.find(
          (pdfItem) => calculateSimilarity(urlItem.name, pdfItem.name) > 0.7
        );

        // Find matching position
        const posMatch = pdfPositions.find(
          (pos) => calculateSimilarity(urlItem.name, pos.name) > 0.7
        );

        // Combine data: URL provides images/descriptions, PDF provides fallbacks
        menuItems.push({
          id: itemId,
          venue_id: venueId,
          name: urlItem.name,
          description: urlItem.description || pdfMatch?.description || "",
          price: urlItem.price || pdfMatch?.price || 0,
          category: urlItem.category || pdfMatch?.category || "Menu Items",
          image_url: urlItem.image_url || null,
          is_available: true,
          position: itemPosition++,
          created_at: new Date().toISOString(),
        });

        if (posMatch) {
          hotspots.push({
            id: uuidv4(),
            venue_id: venueId,
            menu_item_id: itemId,
            page_index: posMatch.page,
            x_percent: posMatch.x,
            y_percent: posMatch.y,
            width_percent: posMatch.x2 - posMatch.x1,
            height_percent: posMatch.y2 - posMatch.y1,
            // Bounding box coordinates (new columns)
            x1_percent: posMatch.x1,
            y1_percent: posMatch.y1,
            x2_percent: posMatch.x2,
            y2_percent: posMatch.y2,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }

        combinedItems.set(urlItem.name.toLowerCase(), true);
      }

      // Add PDF items that weren't matched
      for (const pdfItem of pdfExtractedItems) {
        if (!combinedItems.has(pdfItem.name.toLowerCase())) {
          const itemId = uuidv4();

          const posMatch = pdfPositions.find(
            (pos) => calculateSimilarity(pdfItem.name, pos.name) > 0.7
          );

          menuItems.push({
            id: itemId,
            venue_id: venueId,
            name: pdfItem.name,
            description: pdfItem.description || "",
            price: pdfItem.price,
            category: pdfItem.category,
            image_url: pdfItem.image_url || null,
            is_available: true,
            position: itemPosition++,
            created_at: new Date().toISOString(),
          });

          if (posMatch) {
            hotspots.push({
              id: uuidv4(),
              venue_id: venueId,
              menu_item_id: itemId,
              page_index: posMatch.page,
              x_percent: posMatch.x,
              y_percent: posMatch.y,
              width_percent: posMatch.x2 - posMatch.x1,
              height_percent: posMatch.y2 - posMatch.y1,
              // Store bounding box for overlay cards
              x1_percent: posMatch.x1,
              y1_percent: posMatch.y1,
              x2_percent: posMatch.x2,
              y2_percent: posMatch.y2,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    } else if (urlItems.length > 0) {
      // URL only: use positions from Vision
      logger.info("[MENU IMPORT] Using URL data with PDF positions...");
      for (const item of urlItems) {
        const itemId = uuidv4();
        const posMatch = pdfPositions.find((pos) => calculateSimilarity(item.name, pos.name) > 0.7);

        menuItems.push({
          id: itemId,
          venue_id: venueId,
          name: item.name,
          description: item.description || "",
          price: item.price,
          category: item.category,
          image_url: item.image_url || null,
          is_available: true,
          position: itemPosition++,
          created_at: new Date().toISOString(),
        });

        if (posMatch) {
          hotspots.push({
            id: uuidv4(),
            venue_id: venueId,
            menu_item_id: itemId,
            page_index: posMatch.page,
            x_percent: posMatch.x,
            y_percent: posMatch.y,
            width_percent: posMatch.x2 - posMatch.x1,
            height_percent: posMatch.y2 - posMatch.y1,
            // Bounding box coordinates (new columns)
            x1_percent: posMatch.x1,
            y1_percent: posMatch.y1,
            x2_percent: posMatch.x2,
            y2_percent: posMatch.y2,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      }
    } else {
      // PDF only: use extracted items with positions
      logger.info("[MENU IMPORT] Using PDF data only...");
      for (const item of pdfExtractedItems) {
        const itemId = uuidv4();
        const posMatch = pdfPositions.find((pos) => calculateSimilarity(item.name, pos.name) > 0.7);

        menuItems.push({
          id: itemId,
          venue_id: venueId,
          name: item.name,
          description: item.description || "",
          price: item.price,
          category: item.category,
          image_url: item.image_url || null,
          is_available: true,
          position: itemPosition++,
          created_at: new Date().toISOString(),
        });

        if (posMatch) {
          hotspots.push({
            id: uuidv4(),
            venue_id: venueId,
            menu_item_id: itemId,
            page_index: posMatch.page,
            x_percent: posMatch.x,
            y_percent: posMatch.y,
            width_percent: posMatch.x2 - posMatch.x1,
            height_percent: posMatch.y2 - posMatch.y1,
            // Bounding box coordinates (new columns)
            x1_percent: posMatch.x1,
            y1_percent: posMatch.y1,
            x2_percent: posMatch.x2,
            y2_percent: posMatch.y2,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // Step 4: Clear existing catalog (if replace mode)
    if (replaceMode) {
      const { error: deleteItemsError } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueId);
      if (deleteItemsError) {
        throw new Error(`Failed to delete old items: ${deleteItemsError.message}`);
      }

      const { error: deleteHotspotsError } = await supabase
        .from("menu_hotspots")
        .delete()
        .eq("venue_id", venueId);
      if (deleteHotspotsError) {
        throw new Error(`Failed to delete old hotspots: ${deleteHotspotsError.message}`);
      }
    } else {
      // Intentionally empty
    }

    // Step 5: Extract and preserve category order
    const categoryOrder: string[] = [];
    const seenCategories = new Set<string>();

    // Preserve order from Vision AI extraction (matches PDF order)
    for (const item of pdfExtractedItems) {
      if (item.category && !seenCategories.has(item.category)) {
        categoryOrder.push(item.category);
        seenCategories.add(item.category);
      }
    }

    // Add URL categories if any new ones
    for (const item of urlItems) {
      if (item.category && !seenCategories.has(item.category)) {
        categoryOrder.push(item.category);
        seenCategories.add(item.category);
      }
    }

    // Step 6: Insert new items and hotspots
    if (menuItems.length > 0) {
      const { error: insertItemsError, data: _insertedItems } = await supabase
        .from("menu_items")
        .insert(menuItems)
        .select();
      if (insertItemsError) {
        throw new Error(`Failed to insert items: ${insertItemsError.message}`);
      }
    }

    if (hotspots.length > 0) {
      const { error: insertHotspotsError, data: _insertedHotspots } = await supabase
        .from("menu_hotspots")
        .insert(hotspots)
        .select();
      if (insertHotspotsError) {
        throw new Error(`Failed to insert hotspots: ${insertHotspotsError.message}`);
      }
    }

    // Step 7: Save category order to menu_uploads
    if (categoryOrder.length > 0) {
      await supabase
        .from("menu_uploads")
        .update({ category_order: categoryOrder })
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false })
        .limit(1);
    }

    const duration = Date.now() - startTime;

    logger.info(`[MENU IMPORT ${requestId}] Complete`, {
      items: menuItems.length,
      hotspots: hotspots.length,
      duration,
      sources: {
        url: urlItems.length,
        pdf: pdfExtractedItems.length,
        combined: menuItems.length,
      },
    });

    return NextResponse.json({
      ok: true,
      result: {
        items_created: menuItems.length,
        hotspots_created: hotspots.length,
        categories_created: new Set(menuItems.map((i: { category: string }) => i.category)).size,
      },
    });
  } catch (_err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Processing failed";

    logger.error(`[MENU IMPORT ${requestId}] Error:`, { error: errorMessage, duration });
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
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

  const distance = matrix[s2.length][s1.length];
  return 1 - distance / Math.max(s1.length, s2.length);
}
