import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";

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
 *
 * SECURITY: Uses withUnifiedAuth to enforce venue access, then uses authenticated
 * client that respects RLS (not admin client) to prevent cross-venue access.
 */
export const POST = withUnifiedAuth(async (req: NextRequest, context) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  let logContext: { requestId: string; venueId?: string; menuUrl?: string; userId?: string } = {
    requestId,
  };

  try {
    const body = await req.json();
    const menuUrl = body.menuUrl as string | undefined;

    // venueId comes from context (already verified by withUnifiedAuth)
    const normalizedVenueId = context.venueId;
    logContext = { requestId, venueId: normalizedVenueId, menuUrl, userId: context.user.id };

    logger.info("[HYBRID MERGE] Start", {
      requestId,
      venueId: normalizedVenueId,
      menuUrl,
      timestamp: new Date().toISOString(),
    });

    if (!menuUrl) {
      return NextResponse.json({ ok: false, error: "menuUrl required" }, { status: 400 });
    }

    // Use authenticated client that respects RLS (not admin client)
    // This ensures venue isolation is enforced at the database level
    const supabase = await createClient();

    // Step 1: Fetch stored PDF images from database

    const { data: uploadData, error: uploadError } = await supabase
      .from("menu_uploads")
      .select("pdf_images, filename")
      .eq("venue_id", normalizedVenueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    logger.info("[HYBRID MERGE] PDF upload lookup", {
      ...logContext,
      hasData: !!uploadData,
      error: uploadError?.message || null,
    });

    if (uploadError || !uploadData?.pdf_images) {
      logger.error("[HYBRID ENHANCE] No PDF images found", {
        error: uploadError?.message,
        code: uploadError?.code,
      });
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

    const { error: deleteItemsError } = await supabase
      .from("menu_items")
      .delete()
      .eq("venue_id", normalizedVenueId);

    logger.info("[HYBRID MERGE] Delete existing items", {
      ...logContext,
      error: deleteItemsError?.message || null,
    });

    if (deleteItemsError) {
      logger.error("[HYBRID ENHANCE] Failed to delete existing items", { deleteItemsError });
      throw new Error(`Failed to clear menu: ${deleteItemsError.message}`);
    }

    // Step 5: Run THE ONE TRUE HYBRID EXTRACTION SYSTEM
    logger.info(
      "[HYBRID ENHANCE] ⭐ Using the SAME system as initial upload - no duplicate logic!"
    );

    const { extractMenuHybrid } = await import("@/lib/hybridMenuExtractor");

    logger.info("[HYBRID MERGE] Starting hybrid extraction", {
      ...logContext,
      pdfImageCount: pdfImages.length,
    });

    const extractionResult = await extractMenuHybrid({
      pdfImages,
      websiteUrl: menuUrl,
      venueId: normalizedVenueId,
    });

    logger.info("[HYBRID MERGE] Extraction complete", {
      ...logContext,
      mode: extractionResult.mode,
      itemCount: extractionResult.itemCount,
      extractedItems: extractionResult.items?.length || 0,
    });

    logger.info("[HYBRID ENHANCE] Step 6: Extraction complete!", {
      mode: extractionResult.mode,
      itemCount: extractionResult.itemCount,
    });

    // Step 7: Insert items into database

    const menuItems = [];

    for (let i = 0; i < extractionResult.items.length; i++) {
      const item = extractionResult.items[i];
      const itemId = uuidv4();

      // Convert spice level string to integer for database
      let spiceLevelInt = null;
      if (item.spiceLevel === "mild") spiceLevelInt = 1;
      else if (item.spiceLevel === "medium") spiceLevelInt = 2;
      else if (item.spiceLevel === "hot") spiceLevelInt = 3;

      menuItems.push({
        id: itemId,
        venue_id: normalizedVenueId,
        name: item.name,
        description: item.description || "",
        price: item.price || 0,
        category: item.category || "Menu Items",
        image_url: item.image_url || null,
        allergens: item.allergens || [],
        dietary: item.dietary || [],
        spice_level: spiceLevelInt,
        is_available: true,
        position: i,
        created_at: new Date().toISOString(),
        // NOTE: page_index removed - not in database schema
      });
    }

    // Insert menu items
    if (menuItems.length > 0) {
      logger.info("[HYBRID MERGE] Ready to insert items", {
        ...logContext,
        itemCount: menuItems.length,
        sampleItem: menuItems[0] || null,
      });

      const { data: insertedData, error: insertError } = await supabase
        .from("menu_items")
        .insert(menuItems)
        .select();

      logger.info("[HYBRID MERGE] Insert result", {
        ...logContext,
        insertedCount: insertedData?.length || 0,
        error: insertError?.message || null,
        errorCode: insertError?.code || null,
        errorDetails: insertError?.details || null,
      });

      if (insertError) {
        logger.error("[HYBRID ENHANCE] Failed to insert menu items", {
          error: insertError.message,
          code: insertError.code,
          details: insertError.details,
        });
        throw new Error(`Failed to insert menu items: ${insertError.message}`);
      }
    }

    const duration = Date.now() - startTime;

    logger.info("[HYBRID ENHANCE] ===== ENHANCEMENT COMPLETED SUCCESSFULLY =====", {
      duration: `${(duration / 1000).toFixed(2)}s`,
      mode: extractionResult.mode,
      items: menuItems.length,
    });

    // Revalidate all pages that display menu data
    try {
      revalidatePath(`/dashboard/${normalizedVenueId}`, "layout");
      revalidatePath(`/dashboard/${normalizedVenueId}`, "page");
      revalidatePath(`/dashboard/${normalizedVenueId}/menu-management`, "page");
      revalidatePath(`/menu/${normalizedVenueId}`, "page");
      logger.debug("[HYBRID MERGE] Cache revalidated", logContext);
    } catch (revalidateError) {
      logger.warn("[HYBRID ENHANCE] Cache revalidation failed (non-critical)", {
        error: revalidateError instanceof Error ? revalidateError.message : String(revalidateError),
        stack: revalidateError instanceof Error ? revalidateError.stack : undefined,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Menu enhanced with URL data successfully",
      mode: extractionResult.mode,
      items: menuItems.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("[HYBRID ENHANCE] ===== ENHANCEMENT FAILED =====", {
      ...logContext,
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
});
