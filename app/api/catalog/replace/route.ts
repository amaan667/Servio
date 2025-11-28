import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from '@/lib/api/standard-response';
import { createServerSupabase } from "@/lib/supabase";
import { extractMenuHybrid } from "@/lib/hybridMenuExtractor";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { isDevelopment } from '@/lib/env';

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
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    let normalizedVenueId = "unknown";

    try {
      // STEP 1: Rate limiting (ALWAYS FIRST)
      const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          {
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
          },
          { status: 429 }
        );
      }

      // STEP 2: Get venueId from context (already verified)
      const venueId = context.venueId;
      const user = context.user;

      // Normalize venueId format immediately
      normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      console.log("[CATALOG REPLACE] Starting menu import:", {
        requestId,
        originalVenueId: venueId,
        normalizedVenueId,
        userId: user.id,
        timestamp: new Date().toISOString(),
      });

      logger.info(`[MENU IMPORT ${requestId}] User authenticated:`, { userId: user.id });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const menuUrl = formData.get("menu_url") as string | null;
    const replaceMode = formData.get("replace_mode") !== "false"; // Default to true

    console.log("[CATALOG REPLACE] Request details:", {
      hasFile: !!file,
      fileName: file?.name || null,
      hasUrl: !!menuUrl,
      menuUrl: menuUrl || null,
      replaceMode,
    });

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

    if (!venueId || !normalizedVenueId) {
      console.error("[CATALOG REPLACE] Missing venueId:", { venueId, normalizedVenueId });
      return apiErrors.badRequest('venue_id required');
    }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // Create authenticated Supabase client
      const supabase = await createServerSupabase();

    logger.info(`[MENU IMPORT ${requestId}] Starting menu import`, {
      venueId: normalizedVenueId,
      originalVenueId: venueId,
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
          venue_id: normalizedVenueId,
          filename: file.name,
          pdf_images: pdfImages,
          status: "processed",
          created_at: new Date().toISOString(),
        });

        if (uploadError) {
          logger.warn(`[MENU IMPORT ${requestId}] Failed to save PDF upload:`, uploadError);
        }
      } catch {
        logger.warn(`[MENU IMPORT ${requestId}] Non-critical: PDF upload storage failed`);
      }
    }

    // Step 2: Hybrid Extraction (handles all 3 modes automatically)

    let extractionResult;
    try {
      console.log("[CATALOG REPLACE] Starting hybrid extraction:", {
        hasPdfImages: !!pdfImages,
        pdfImageCount: pdfImages?.length || 0,
        hasUrl: !!menuUrl,
        normalizedVenueId,
      });

      extractionResult = await extractMenuHybrid({
        pdfImages,
        websiteUrl: menuUrl || undefined,
        venueId: normalizedVenueId,
      });

      console.log("[CATALOG REPLACE] Extraction complete:", {
        mode: extractionResult.mode,
        itemCount: extractionResult.itemCount,
        extractedItems: extractionResult.items?.length || 0,
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
      console.log("[CATALOG REPLACE] Replace mode - deleting existing items:", {
        normalizedVenueId,
        timestamp: new Date().toISOString(),
      });
      
      // Delete all existing items
      const { error: deleteItemsError } = await supabase
        .from("menu_items")
        .delete()
        .eq("venue_id", normalizedVenueId);

      console.log("[CATALOG REPLACE] Delete result:", {
        error: deleteItemsError?.message || null,
        errorCode: deleteItemsError?.code || null,
      });

      if (deleteItemsError) {
        logger.error(`[MENU IMPORT ${requestId}] Failed to delete items:`, deleteItemsError);
        throw new Error(`Failed to delete old items: ${deleteItemsError.message}`);
      }
    } else {
      // Append mode - keep existing items
    }

    // Step 4: Prepare items for database
    const menuItems = [];
    
    console.log("[CATALOG REPLACE] Preparing items for database:", {
      extractionResultItemCount: extractionResult.items.length,
      normalizedVenueId,
    });

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
      });
    }

    // Step 5: Insert into database
    console.log("[CATALOG REPLACE] Ready to insert items:", {
      itemCount: menuItems.length,
      normalizedVenueId,
      sampleItem: menuItems[0] || null,
    });

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

      console.log("[CATALOG REPLACE] Insert result:", {
        insertedCount: data?.length || 0,
        error: insertItemsError?.message || null,
        errorCode: insertItemsError?.code || null,
        errorDetails: insertItemsError?.details || null,
        errorHint: insertItemsError?.hint || null,
      });

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
      revalidatePath(`/dashboard/${normalizedVenueId}`, "layout");
      revalidatePath(`/dashboard/${normalizedVenueId}`, "page");
      revalidatePath(`/dashboard/${normalizedVenueId}/menu-management`, "page");
      revalidatePath(`/dashboard/${normalizedVenueId}/menu-management`, "layout");

      // Revalidate menu pages
      revalidatePath(`/menu/${normalizedVenueId}`, "page");
      revalidatePath(`/order/${normalizedVenueId}`, "page");

      logger.info(
        `[MENU IMPORT ${requestId}] ✅ Cache revalidated aggressively for venue ${normalizedVenueId}`
      );
    } catch (revalidateError) {
      logger.warn(
        `[MENU IMPORT ${requestId}] ⚠️ Cache revalidation failed (non-critical)`,
        revalidateError
      );
    }

    console.log("[CATALOG REPLACE] Import complete:", {
      requestId,
      itemCount: menuItems.length,
      mode: extractionResult.mode,
      duration: `${duration}ms`,
      normalizedVenueId,
    });

      // STEP 7: Return success response
      return NextResponse.json({
        ok: true,
        message: "Menu imported successfully",
        items: menuItems.length,
        mode: extractionResult.mode,
        duration: `${duration}ms`,
      });
    } catch (_error) {
      const duration = Date.now() - startTime;
      const errorMessage = _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      const errorName = _error instanceof Error ? _error.name : "UnknownError";
      
      // Enhanced error logging
      console.error(`[CATALOG REPLACE] Error caught:`, {
        requestId,
        errorName,
        errorMessage,
        errorStack,
        duration: `${duration}ms`,
        venueId: context?.venueId || "unknown",
        normalizedVenueId: normalizedVenueId || "unknown",
        userId: context?.user?.id || "unknown",
        errorObject: _error,
      });
      
      logger.error(`[MENU IMPORT ${requestId}] Failed:`, {
        error: errorMessage,
        errorName,
        stack: errorStack,
        duration: `${duration}ms`,
        venueId: context?.venueId || "unknown",
        normalizedVenueId: normalizedVenueId || "unknown",
        userId: context?.user?.id || "unknown",
      });
      
      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {
            ok: false,
            error: errorMessage.includes("Unauthorized") ? "Unauthorized" : "Forbidden",
            message: errorMessage,
          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }
      
      return NextResponse.json(
        {
          ok: false,
          error: "Menu import failed",
          message: isDevelopment() ? errorMessage : "Failed to import menu",
          requestId,
          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from query params (preferred) or form data
    // NOTE: We prefer query params to avoid consuming the request body
    extractVenueId: async (req) => {
      try {
        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");
        
        if (!venueId) {
          // Fallback: Try to read from formData (this will consume the body, so it's a last resort)
          // In practice, venueId should be in query params to avoid this issue
          console.warn("[CATALOG REPLACE] venueId not in query params, attempting to read from formData (may cause body consumption issues)");
          try {
            // Clone request to avoid consuming original body
            const clonedReq = req.clone();
            const formData = await clonedReq.formData();
            venueId = formData.get("venue_id") as string || formData.get("venueId") as string || null;
          } catch (formDataError) {
            console.error("[CATALOG REPLACE] Failed to read formData in extractVenueId:", {
              error: formDataError instanceof Error ? formDataError.message : String(formDataError),
            });
            // venueId remains null - will need to be extracted in main handler
          }
        }
        
        // Ensure extracted venueId is normalized before returning
        const normalized = venueId ? (venueId.startsWith("venue-") ? venueId : `venue-${venueId}`) : null;
        console.log("[CATALOG REPLACE] extractVenueId result:", {
          originalVenueId: venueId,
          normalizedVenueId: normalized,
          source: searchParams.get("venueId") ? "query" : "formData",
        });
        return normalized;
      } catch (error) {
        console.error("[CATALOG REPLACE] Error in extractVenueId:", {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    },
  }
);
