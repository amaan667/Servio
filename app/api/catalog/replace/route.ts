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
    });

    // Step 2.5: Post-process to fix "Menu Items" categorizations
    const existingCategories = Array.from(
      new Set(
        extractionResult.items
          .map((item: any) => item.category)
          .filter((c: string) => c && c !== "Menu Items")
      )
    );

    logger.info(`[MENU IMPORT ${requestId}] Post-processing categories`, {
      existingCategories,
      menuItemsCount: extractionResult.items.filter((item: any) => item.category === "Menu Items")
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
          finalCategories: Array.from(
            new Set(extractionResult.items.map((item: any) => item.category))
          ),
        }
      );
    }

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

      logger.info(`[MENU IMPORT ${requestId}] Existing menu cleared`);
    } else {
      logger.info(`[MENU IMPORT ${requestId}] APPEND mode - keeping existing menu`);
    }

    // Step 4: Prepare items for database
    const menuItems = [];

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
        allergens: item.allergens || [],
        dietary: item.dietary || [],
        spice_level: item.spiceLevel || null,
        is_available: true,
        position: i,
        created_at: new Date().toISOString(),
      });
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
