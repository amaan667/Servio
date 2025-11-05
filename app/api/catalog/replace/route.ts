import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { getAuthUserForAPI } from "@/lib/auth/server";
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
    // Authenticate user
    const { user, error: authError } = await getAuthUserForAPI();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

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

    // Create authenticated Supabase client
    const supabase = await createServerSupabase();

    // Verify venue access
    const { data: venueAccess } = await supabase
      .from("venues")
      .select("venue_id")
      .eq("venue_id", venueId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    const { data: staffAccess } = await supabase
      .from("user_venue_roles")
      .select("role")
      .eq("venue_id", venueId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!venueAccess && !staffAccess) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    logger.info(`[MENU IMPORT ${requestId}] Starting menu import`, {
      venueId,
      userId: user.id,
      hasFile: !!file,
      hasUrl: !!menuUrl,
      replaceMode,
    });

    // Step 1: Convert PDF to images (if PDF provided)
    let pdfImages: string[] | undefined;

    if (file) {
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

    let extractionResult;
    try {
      extractionResult = await extractMenuHybrid({
        pdfImages,
        websiteUrl: menuUrl || undefined,
        venueId,
      });

      logger.info(`[MENU IMPORT ${requestId}] Extraction complete`, {
        mode: extractionResult.mode,
        itemCount: extractionResult.itemCount,
      });
    } catch (extractionError) {
      logger.error(`[MENU IMPORT ${requestId}] Extraction failed`, {
        error: extractionError instanceof Error ? extractionError.message : String(extractionError),
        stack: extractionError instanceof Error ? extractionError.stack : undefined,
      });
      throw extractionError;
    }

    // Step 2.5: Post-process to fix "Menu Items" categorizations
    const existingCategories = Array.from(
      new Set(
        extractionResult.items
          .map((item) => item.category)
          .filter((c): c is string => Boolean(c) && c !== "Menu Items")
      )
    );

    logger.info(`[MENU IMPORT ${requestId}] Post-processing categories`, {
      existingCategories,
      menuItemsCount: extractionResult.items.filter((item) => item.category === "Menu Items")
        .length,
    });

    // Enhanced category keyword mapping for intelligent recategorization
    const categoryKeywordMap: { [key: string]: string[] } = {
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
        "avocado toast",
      ],
      coffee: [
        "coffee",
        "espresso",
        "latte",
        "cappuccino",
        "americano",
        "mocha",
        "flat white",
        "cortado",
      ],
      tea: ["tea", "chai", "matcha", "oolong", "green tea", "earl grey", "chamomile"],
      drinks: ["juice", "smoothie", "water", "soda", "drink", "beverage", "lemonade", "milkshake"],
      desserts: ["dessert", "cake", "cheesecake", "tiramisu", "mousse", "pudding", "sweet", "tart"],
      mains: ["burger", "pasta", "pizza", "rice", "chicken", "beef", "lamb", "fish", "steak"],
    };

    // Fix "Menu Items" assignments
    let recategorizedCount = 0;
    for (const item of extractionResult.items) {
      if (item.category === "Menu Items") {
        const itemText = `${item.name} ${item.description || ""}`.toLowerCase();
        let newCategory = null;

        // Try to match to existing categories using keywords
        for (const existingCat of existingCategories) {
          const catNormalized = existingCat.toLowerCase();

          // Check if item keywords match this category
          for (const [genericCat, keywords] of Object.entries(categoryKeywordMap)) {
            if (catNormalized.includes(genericCat)) {
              for (const keyword of keywords) {
                if (itemText.includes(keyword)) {
                  newCategory = existingCat;
                  break;
                }
              }
              if (newCategory) break;
            }
          }
          if (newCategory) break;
        }

        if (newCategory) {
          logger.info(`[MENU IMPORT ${requestId}] Recategorizing item`, {
            item: item.name,
            from: "Menu Items",
            to: newCategory,
          });
          item.category = newCategory;
          recategorizedCount++;
        }
      }
    }

    if (recategorizedCount > 0) {
      logger.info(
        `[MENU IMPORT ${requestId}] Recategorized ${recategorizedCount} items from "Menu Items"`,
        {
          finalCategories: Array.from(new Set(extractionResult.items.map((item) => item.category))),
        }
      );
    }

    // Step 3: Replace or Append mode
    if (replaceMode) {
      // Delete all existing items
      const { error: deleteItemsError } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", venueId);

      if (deleteItemsError) {
        logger.error(`[MENU IMPORT ${requestId}] Failed to delete items:`, deleteItemsError);
        throw new Error(`Failed to delete old items: ${deleteItemsError.message}`);
      }
    } else {
      // Append mode - keep existing items
    }

    // Step 4: Prepare items for database
    const menuItems = [];

    for (let i = 0; i < extractionResult.items.length; i++) {
      const item = extractionResult.items[i];
      const itemId = uuidv4();

      // Insert menu item
      // Convert spice level string to integer for database
      let spiceLevelInt = null;
      if (item.spiceLevel === "mild") spiceLevelInt = 1;
      else if (item.spiceLevel === "medium") spiceLevelInt = 2;
      else if (item.spiceLevel === "hot") spiceLevelInt = 3;

      menuItems.push({
        id: itemId,
        venue_id: venueId,
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
      });
    }

    // Step 5: Insert into database
    if (menuItems.length > 0) {
      logger.info(
        `[MENU IMPORT ${requestId}] Inserting ${menuItems.length} items into database...`
      );
      logger.info(`[MENU IMPORT ${requestId}] Sample item for debugging:`, {
        sample: menuItems[0],
      });

      const { data, error: insertItemsError } = await supabase
        .from("menu_items")
        .insert(menuItems)
        .select();

      if (insertItemsError) {
        logger.error(`[MENU IMPORT ${requestId}] Database insert failed`, {
          error: insertItemsError.message,
          code: insertItemsError.code,
          details: insertItemsError.details,
          hint: insertItemsError.hint,
        });
        throw new Error(`Failed to insert items: ${insertItemsError.message}`);
      }

      logger.info(
        `[MENU IMPORT ${requestId}] ✅ ${data.length} items inserted successfully into database`
      );
    } else {
      logger.warn(`[MENU IMPORT ${requestId}] ⚠️ No items to insert - extraction returned 0 items`);
    }

    const duration = Date.now() - startTime;

    logger.info(`[MENU IMPORT ${requestId}] Import complete!`, {
      duration: `${duration}ms`,
      mode: extractionResult.mode,
      itemCount: menuItems.length,
      replaceMode,
    });

    // Revalidate all pages that display menu data - AGGRESSIVE CACHE BUSTING
    try {
      // Revalidate the entire dashboard layout and all nested routes
      revalidatePath(`/dashboard/${venueId}`, "layout");
      revalidatePath(`/dashboard/${venueId}`, "page");
      revalidatePath(`/dashboard/${venueId}/menu-management`, "page");
      revalidatePath(`/dashboard/${venueId}/menu-management`, "layout");

      // Revalidate menu pages
      revalidatePath(`/menu/${venueId}`, "page");
      revalidatePath(`/order/${venueId}`, "page");

      logger.info(
        `[MENU IMPORT ${requestId}] ✅ Cache revalidated aggressively for venue ${venueId}`
      );
    } catch (revalidateError) {
      logger.warn(
        `[MENU IMPORT ${requestId}] ⚠️ Cache revalidation failed (non-critical)`,
        revalidateError
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Menu imported successfully",
      items: menuItems.length,
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
