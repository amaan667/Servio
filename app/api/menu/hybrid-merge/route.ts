import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

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

    if (uploadError || !uploadData?.pdf_images) {

      return NextResponse.json(
        {
          ok: false,
          error: "No PDF found. Please upload a PDF first, or clear menu and upload both together.",
        },
        { status: 400 }
      );
    }

    const pdfImages = uploadData.pdf_images as string[];

    // Step 3: Clear existing menu for clean re-extraction

    const { error: deleteItemsError } = await supabase
      .from("menu_items")
      .delete()
      .eq("venue_id", normalizedVenueId);

    if (deleteItemsError) {

      throw new Error(`Failed to clear menu: ${deleteItemsError.message}`);
    }

    // Step 5: Run THE ONE TRUE HYBRID EXTRACTION SYSTEM

    const { extractMenuHybrid } = await import("@/lib/hybridMenuExtractor");

    const extractionResult = await extractMenuHybrid({
      pdfImages,
      websiteUrl: menuUrl,
      venueId: normalizedVenueId,
    });

    // Step 7: Insert items into database

    const menuItems = [];

    for (let i = 0; i < extractionResult.items.length; i++) {
      const item = extractionResult.items[i]!;
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

      const { data: insertedData, error: insertError } = await supabase
        .from("menu_items")
        .insert(menuItems)
        .select();

      if (insertError) {

        throw new Error(`Failed to insert menu items: ${insertError.message}`);
      }
    }

    const duration = Date.now() - startTime;

    // Revalidate all pages that display menu data
    try {
      revalidatePath(`/dashboard/${normalizedVenueId}`, "layout");
      revalidatePath(`/dashboard/${normalizedVenueId}`, "page");
      revalidatePath(`/dashboard/${normalizedVenueId}/menu-management`, "page");
      revalidatePath(`/menu/${normalizedVenueId}`, "page");

    } catch (revalidateError) { /* Error handled silently */ }

    return NextResponse.json({
      ok: true,
      message: "Menu enhanced with URL data successfully",
      mode: extractionResult.mode,
      items: menuItems.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Menu enhancement failed",
      },
      { status: 500 }
    );
  }
});
