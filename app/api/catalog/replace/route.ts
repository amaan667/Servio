import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { extractMenuHybrid } from "@/lib/hybridMenuExtractor";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for processing

/**
 * Unified Menu Import API - Supports 3 Modes:
 * 1. URL only - Web scraping with Puppeteer + Vision AI
 * 2. PDF only - Vision AI extraction
 * 3. Hybrid (PDF + URL) - Best of both worlds
 *
 * Replace/Append toggle applies to ALL modes
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const venueId = formData.get("venue_id") as string;
    const menuUrl = formData.get("menu_url") as string | null;
    const replaceMode = formData.get("replace_mode") !== "false"; // Default to true

    // VALIDATION: Must have at least one source (PDF or URL)
    if (!file && !menuUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Please provide either a PDF file or a website URL (or both)",
        },
        { status: 400 }
      );
    }

    if (!venueId) {
      return NextResponse.json({ ok: false, error: "venue_id required" }, { status: 400 });
    }

    logger.info(`[MENU IMPORT ${requestId}] Starting menu import`, {
      venueId,
      hasFile: !!file,
      hasUrl: !!menuUrl,
      replaceMode,
    });

    const supabase = createAdminClient();

    // Step 1: Convert PDF to images (if PDF provided)
    let pdfImages: string[] | undefined;

    if (file) {
      logger.info(`[MENU IMPORT ${requestId}] Converting PDF to images...`);
      const pdfBuffer = Buffer.from(await file.arrayBuffer());

      try {
        const { convertPDFToImages } = await import("@/lib/pdf-to-images-serverless");
        pdfImages = await convertPDFToImages(pdfBuffer);
        logger.info(`[MENU IMPORT ${requestId}] PDF conversion complete`, {
          pageCount: pdfImages.length,
        });
      } catch (conversionError) {
        logger.error(`[MENU IMPORT ${requestId}] PDF conversion failed:`, conversionError);
        throw new Error("PDF conversion failed. Please check file format.");
      }

      // Store PDF images in database
      try {
        const { error: uploadError } = await supabase.from("menu_uploads").insert({
          venue_id: venueId,
          filename: file.name,
          pdf_images: pdfImages,
          status: "processed",
          created_at: new Date().toISOString(),
        });

        if (uploadError) {
          logger.warn(`[MENU IMPORT ${requestId}] Failed to save PDF upload:`, uploadError);
        }
      } catch (e) {
        logger.warn(`[MENU IMPORT ${requestId}] Non-critical: PDF upload storage failed`);
      }
    }

    // Step 2: Hybrid Extraction (handles all 3 modes automatically)
    logger.info(`[MENU IMPORT ${requestId}] Starting extraction...`);

    const extractionResult = await extractMenuHybrid({
      pdfImages,
      websiteUrl: menuUrl || undefined,
      venueId,
    });

    logger.info(`[MENU IMPORT ${requestId}] Extraction complete`, {
      mode: extractionResult.mode,
      itemCount: extractionResult.itemCount,
      positionCount: extractionResult.positions.length,
    });

    // Step 3: Replace or Append mode
    if (replaceMode) {
      logger.info(`[MENU IMPORT ${requestId}] REPLACE mode - deleting existing menu...`);

      // Delete all existing items
      const { error: deleteItemsError } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueId);

      if (deleteItemsError) {
        logger.error(`[MENU IMPORT ${requestId}] Failed to delete items:`, deleteItemsError);
        throw new Error(`Failed to delete old items: ${deleteItemsError.message}`);
      }

      // Delete all existing hotspots
      const { error: deleteHotspotsError } = await supabase
        .from("menu_hotspots")
        .delete()
        .eq("venue_id", venueId);

      if (deleteHotspotsError) {
        logger.warn(`[MENU IMPORT ${requestId}] Failed to delete hotspots:`, deleteHotspotsError);
      }

      logger.info(`[MENU IMPORT ${requestId}] Existing menu cleared`);
    } else {
      logger.info(`[MENU IMPORT ${requestId}] APPEND mode - keeping existing menu`);
    }

    // Step 4: Prepare items for database
    const menuItems = [];
    const hotspots = [];

    for (let i = 0; i < extractionResult.items.length; i++) {
      const item = extractionResult.items[i];
      const itemId = uuidv4();

      // Insert menu item
      menuItems.push({
        id: itemId,
        venue_id: venueId,
        name: item.name,
        description: item.description || "",
        price: item.price || 0,
        category: item.category || "Menu Items",
        image_url: item.image_url || null,
        is_available: true,
        position: i,
        created_at: new Date().toISOString(),
      });

      // Find matching position for hotspot
      const position = extractionResult.positions.find((pos) => {
        const nameSimilarity = calculateSimilarity(
          item.name.toLowerCase().trim(),
          (pos.name_normalized || pos.name).toLowerCase().trim()
        );
        return nameSimilarity > 0.7;
      });

      // Create hotspot if position found
      if (position) {
        hotspots.push({
          id: uuidv4(),
          venue_id: venueId,
          menu_item_id: itemId,
          page_index: position.page_index || 0,
          x_percent: position.x || (position.x1 + position.x2) / 2,
          y_percent: position.y || (position.y1 + position.y2) / 2,
          width_percent: position.x2 - position.x1,
          height_percent: position.y2 - position.y1,
          x1_percent: position.x1,
          y1_percent: position.y1,
          x2_percent: position.x2,
          y2_percent: position.y2,
          button_x_percent: position.button_x,
          button_y_percent: position.button_y,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Step 5: Insert into database
    if (menuItems.length > 0) {
      logger.info(`[MENU IMPORT ${requestId}] Inserting ${menuItems.length} items...`);

      const { error: insertItemsError } = await supabase.from("menu_items").insert(menuItems);

      if (insertItemsError) {
        logger.error(`[MENU IMPORT ${requestId}] Failed to insert items:`, insertItemsError);
        throw new Error(`Failed to insert items: ${insertItemsError.message}`);
      }

      logger.info(`[MENU IMPORT ${requestId}] Items inserted successfully`);
    }

    if (hotspots.length > 0) {
      logger.info(`[MENU IMPORT ${requestId}] Inserting ${hotspots.length} hotspots...`);

      const { error: insertHotspotsError } = await supabase.from("menu_hotspots").insert(hotspots);

      if (insertHotspotsError) {
        logger.error(`[MENU IMPORT ${requestId}] Failed to insert hotspots:`, insertHotspotsError);
        // Non-critical - menu still works without hotspots
      } else {
        logger.info(`[MENU IMPORT ${requestId}] Hotspots inserted successfully`);
      }
    }

    const duration = Date.now() - startTime;

    logger.info(`[MENU IMPORT ${requestId}] Import complete!`, {
      duration: `${duration}ms`,
      mode: extractionResult.mode,
      itemCount: menuItems.length,
      hotspotCount: hotspots.length,
      replaceMode,
    });

    // Revalidate all pages that display menu data
    try {
      revalidatePath(`/dashboard/${venueId}/menu-management`, "page");
      revalidatePath(`/dashboard/${venueId}`, "page");
      revalidatePath(`/menu/${venueId}`, "page");
      logger.info(`[MENU IMPORT ${requestId}] Cache revalidated for venue ${venueId}`);
    } catch (revalidateError) {
      logger.warn(
        `[MENU IMPORT ${requestId}] Cache revalidation failed (non-critical)`,
        revalidateError
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Menu imported successfully",
      items: menuItems.length,
      hotspots: hotspots.length,
      mode: extractionResult.mode,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[MENU IMPORT ${requestId}] Failed:`, {
      error,
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Menu import failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm
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
