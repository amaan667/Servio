import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * Hybrid Menu Enhancement API - Unified System
 *
 * IMPORTANT: This endpoint now uses THE SAME hybrid extraction logic as initial upload
 * No more duplicate merge systems - everything uses extractMenuHybrid()
 *
 * When user uploads PDF first, then adds URL later, this:
 * 1. Fetches stored PDF images from database
 * 2. Re-runs full hybrid extraction with URL
 * 3. Uses ONE unified algorithm (same as /api/catalog/replace)
 * 4. Ensures identical results regardless of upload order
 *
 * RESULT: PDF→URL and URL→PDF produce the same output
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

    logger.info("[HYBRID ENHANCE] ===== STARTING URL ENHANCEMENT =====");
    logger.info("[HYBRID ENHANCE] Using unified hybrid extraction system");
    logger.info("[HYBRID ENHANCE] Input:", { venueId, menuUrl });

    // Step 1: Fetch stored PDF images from database
    logger.info("[HYBRID ENHANCE] Step 1: Fetching stored PDF images from database...");

    const { data: uploadData, error: uploadError } = await supabase
      .from("menu_uploads")
      .select("pdf_images, filename")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (uploadError || !uploadData?.pdf_images) {
      logger.error("[HYBRID ENHANCE] No PDF images found", { uploadError });
      return NextResponse.json(
        {
          ok: false,
          error: "No PDF found. Please upload a PDF first, or clear menu and upload both together.",
        },
        { status: 400 }
      );
    }

    const pdfImages = uploadData.pdf_images as string[];
    logger.info("[HYBRID ENHANCE] Step 2: PDF images retrieved from database", {
      pageCount: pdfImages.length,
      originalFile: uploadData.filename,
    });

    // Step 3: Clear existing menu for clean re-extraction
    logger.info("[HYBRID ENHANCE] Step 3: Clearing existing menu for clean re-extraction...");

    const { error: deleteItemsError } = await supabase
      .from("menu_items")
      .delete()
      .eq("venue_id", venueId);

    if (deleteItemsError) {
      logger.error("[HYBRID ENHANCE] Failed to delete existing items", { deleteItemsError });
      throw new Error(`Failed to clear menu: ${deleteItemsError.message}`);
    }

    const { error: deleteHotspotsError } = await supabase
      .from("menu_hotspots")
      .delete()
      .eq("venue_id", venueId);

    if (deleteHotspotsError) {
      logger.warn("[HYBRID ENHANCE] Failed to delete hotspots", { deleteHotspotsError });
    }

    logger.info("[HYBRID ENHANCE] Step 4: Existing menu cleared successfully");

    // Step 5: Run THE ONE TRUE HYBRID EXTRACTION SYSTEM
    logger.info("[HYBRID ENHANCE] Step 5: Running unified hybrid extraction...");
    logger.info(
      "[HYBRID ENHANCE] ⭐ Using the SAME system as initial upload - no duplicate logic!"
    );

    const { extractMenuHybrid } = await import("@/lib/hybridMenuExtractor");

    const extractionResult = await extractMenuHybrid({
      pdfImages,
      websiteUrl: menuUrl,
      venueId,
    });

    logger.info("[HYBRID ENHANCE] Step 6: Extraction complete!", {
      mode: extractionResult.mode,
      itemCount: extractionResult.itemCount,
      positionCount: extractionResult.positions.length,
    });

    // Step 7: Insert items and hotspots into database
    logger.info("[HYBRID ENHANCE] Step 7: Inserting items into database...");

    const menuItems = [];
    const hotspots = [];

    for (let i = 0; i < extractionResult.items.length; i++) {
      const item = extractionResult.items[i];

      menuItems.push({
        venue_id: venueId,
        name: item.name,
        description: item.description || "",
        price: item.price || 0,
        category: item.category || "Menu Items",
        image_url: item.image_url || null,
        is_available: true,
        position: i,
        page_index: item.page_index || 0,
      });
    }

    // Insert menu items
    if (menuItems.length > 0) {
      const { error: insertError } = await supabase.from("menu_items").insert(menuItems);

      if (insertError) {
        logger.error("[HYBRID ENHANCE] Failed to insert menu items", {
          error: insertError.message,
        });
        throw new Error(`Failed to insert menu items: ${insertError.message}`);
      }

      logger.info("[HYBRID ENHANCE] Items inserted successfully");
    }

    // Insert hotspots
    for (let i = 0; i < extractionResult.positions.length; i++) {
      const pos = extractionResult.positions[i];

      hotspots.push({
        venue_id: venueId,
        page_index: pos.page_index || 0,
        item_name: pos.name || pos.item_name,
        x1_percent: pos.x1 || pos.x1_percent || 0,
        y1_percent: pos.y1 || pos.y1_percent || 0,
        x2_percent: pos.x2 || pos.x2_percent || 0,
        y2_percent: pos.y2 || pos.y2_percent || 0,
        button_x_percent: pos.button_x || pos.button_x_percent,
        button_y_percent: pos.button_y || pos.button_y_percent,
      });
    }

    if (hotspots.length > 0) {
      const { error: hotspotsError } = await supabase.from("menu_hotspots").insert(hotspots);

      if (hotspotsError) {
        logger.warn("[HYBRID ENHANCE] Failed to insert hotspots", {
          error: hotspotsError.message,
        });
      } else {
        logger.info("[HYBRID ENHANCE] Hotspots inserted successfully");
      }
    }

    const duration = Date.now() - startTime;

    logger.info("[HYBRID ENHANCE] ===== ENHANCEMENT COMPLETED SUCCESSFULLY =====", {
      duration: `${(duration / 1000).toFixed(2)}s`,
      mode: extractionResult.mode,
      items: menuItems.length,
      hotspots: hotspots.length,
    });

    // Revalidate all pages that display menu data
    try {
      revalidatePath(`/dashboard/${venueId}`, "layout");
      revalidatePath(`/dashboard/${venueId}`, "page");
      revalidatePath(`/dashboard/${venueId}/menu-management`, "page");
      revalidatePath(`/menu/${venueId}`, "page");
      logger.info("[HYBRID ENHANCE] Cache revalidated");
    } catch (revalidateError) {
      logger.warn("[HYBRID ENHANCE] Cache revalidation failed (non-critical)", revalidateError);
    }

    return NextResponse.json({
      ok: true,
      message: "Menu enhanced with URL data successfully",
      mode: extractionResult.mode,
      items: menuItems.length,
      hotspots: hotspots.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("[HYBRID ENHANCE] ===== ENHANCEMENT FAILED =====", {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`,
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Menu enhancement failed",
      },
      { status: 500 }
    );
  }
}
