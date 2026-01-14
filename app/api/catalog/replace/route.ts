import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
import { createServerSupabase } from "@/lib/supabase";
import { extractMenuHybrid } from "@/lib/hybridMenuExtractor";

// Import MenuItem type from hybrid extractor for extracted items
type ExtractedMenuItem = {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  allergens?: string[];
  dietary?: string[];
  spiceLevel?: string | null;
  page_index?: number;
  source?: string;
  has_web_enhancement?: boolean;
  has_image?: boolean;
  merge_source?: string;
  name_normalized?: string;
  _matchReason?: string;
  _matchConfidence?: number;
  _matchScore?: number;
  _unmatched?: boolean;
};

// Type for menu items as stored in database (matches the hook interface)
type DatabaseMenuItem = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  allergens: string[];
  dietary: string[];
  spice_level: number | null;
  is_available: boolean;
  position: number;
  created_at: string;
  // Additional properties used in merging logic
  source?: string;
  spiceLevel: string | null;
  _matchConfidence?: number;
};
import { v4 as uuidv4 } from "uuid";

import { revalidatePath } from "next/cache";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'heic': 'image/heic'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Intelligently merge existing database items with newly extracted items
 * Enhances existing items with better data and adds new items
 */
async function mergeItemsIntelligently(
  existingItems: DatabaseMenuItem[],
  newItems: ExtractedMenuItem[],
  venueId: string
): Promise<DatabaseMenuItem[]> {
  // Start with all existing items
  const resultItems: DatabaseMenuItem[] = [...existingItems];
  const processedExistingNames = new Set<string>();

  // Import matching functions
  const { findBestMatch } = await import("@/lib/hybridMenuExtractor");

  for (const newItem of newItems) {
    // Check if this new item matches any existing item
    const existingFormatted = existingItems
      .filter(item => !processedExistingNames.has(item.name))
      .map(item => ({
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        image_url: item.image_url,
        allergens: item.allergens || [],
        dietary: item.dietary || [],
        spiceLevel: item.spice_level === 1 ? "mild" : item.spice_level === 2 ? "medium" : item.spice_level === 3 ? "hot" : null,
      }));

    const matchResult = findBestMatch(newItem, existingFormatted as ExtractedMenuItem[]);

    if (matchResult && matchResult.confidence >= 0.7) {
      // Found a match - enhance the existing item with better data from new item
      const existingIndex = resultItems.findIndex(item => item.name === matchResult.item.name);
      if (existingIndex !== -1) {
        const existingItem = resultItems[existingIndex];
        processedExistingNames.add(existingItem.name);

        // Intelligently merge - prefer better/more complete data
        resultItems[existingIndex] = {
          ...existingItem,
          // Prefer new data if it's better/more complete
          description: newItem.description && (!existingItem.description || existingItem.description.length < newItem.description.length)
            ? newItem.description
            : existingItem.description,
          price: newItem.price !== undefined && newItem.price > 0 ? newItem.price : existingItem.price,
          category: newItem.category && newItem.category !== "Menu Items" ? newItem.category : existingItem.category,
          // Always prefer new images (they're usually better quality)
          image_url: newItem.image_url || existingItem.image_url,
          // Merge arrays intelligently
          allergens: [...new Set([...(existingItem.allergens || []), ...(newItem.allergens || [])])],
          dietary: [...new Set([...(existingItem.dietary || []), ...(newItem.dietary || [])])],
          // Prefer spice level if new item has it
          spice_level: newItem.spiceLevel === "mild" ? 1 : newItem.spiceLevel === "medium" ? 2 : newItem.spiceLevel === "hot" ? 3 : existingItem.spice_level,
          spiceLevel: newItem.spiceLevel || existingItem.spiceLevel,
          // Mark as enhanced
          source: "enhanced_existing",
          _matchConfidence: matchResult.confidence,
        };
      }
    } else {
      // No match found - add as new item
      const newItemWithId: DatabaseMenuItem = {
        id: uuidv4(),
        venue_id: venueId,
        name: newItem.name,
        description: newItem.description || null,
        price: newItem.price || 0,
        category: newItem.category || "Menu Items",
        image_url: newItem.image_url || null,
        allergens: newItem.allergens || [],
        dietary: newItem.dietary || [],
        spice_level: newItem.spiceLevel === "mild" ? 1 : newItem.spiceLevel === "medium" ? 2 : newItem.spiceLevel === "hot" ? 3 : null,
        is_available: true,
        position: 0, // Will be sorted later
        created_at: new Date().toISOString(),
        source: "new_appended",
        spiceLevel: newItem.spiceLevel || null,
      };
      resultItems.push(newItemWithId);
    }
  }

  // Sort items by position/category for consistency
  resultItems.sort((a, b) => {
    const catA = a.category || "ZZZ";
    const catB = b.category || "ZZZ";
    if (catA !== catB) return catA.localeCompare(catB);
    return (a.position || 0) - (b.position || 0);
  });

  return resultItems;
}

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
            error: "Too many requests",
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

      const formData = await req.formData();
      const file = formData.get("file") as File | null;
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

      if (!venueId || !normalizedVenueId) {

        return apiErrors.badRequest("venue_id required");
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      // Create authenticated Supabase client
      const supabase = await createServerSupabase();

      // Step 1: Convert file to images (PDF or direct image)
      let pdfImages: string[] | undefined;

      if (file) {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type || getMimeTypeFromExtension(file.name);

        try {
          if (mimeType === 'application/pdf') {
            // Convert PDF to images
            const { convertPDFToImages } = await import("@/lib/pdf-to-images-serverless");
            pdfImages = await convertPDFToImages(fileBuffer);
          } else if (mimeType.startsWith('image/')) {
            // Convert image to base64 data URL for processing
            const base64 = fileBuffer.toString('base64');
            const dataUrl = `data:${mimeType};base64,${base64}`;
            pdfImages = [dataUrl];
          } else {
            throw new Error(`Unsupported file type: ${mimeType}`);
          }

        } catch (conversionError) {
          const fileType = mimeType === 'application/pdf' ? 'PDF' : 'image';
          throw new Error(`${fileType} processing failed. Please check file format and try again.`);
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

          if (uploadError) { /* Condition handled */ }
        } catch { /* Error handled silently */ }
      }

      // Step 2: Hybrid Extraction (handles all 3 modes automatically)

      let extractionResult;
      try {

        extractionResult = await extractMenuHybrid({
          pdfImages,
          websiteUrl: menuUrl || undefined,
          venueId: normalizedVenueId,
        });

      } catch (extractionError) {

        throw extractionError;
      }

      // Step 2.5: Post-process to fix "Menu Items" categorizations
      let existingCategories = Array.from(
        new Set(
          extractionResult.items
            .map((item) => item.category)
            .filter((c): c is string => Boolean(c) && c !== "Menu Items")
        )
      );

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
        drinks: [
          "juice",
          "smoothie",
          "water",
          "soda",
          "drink",
          "beverage",
          "lemonade",
          "milkshake",
        ],
        desserts: [
          "dessert",
          "cake",
          "cheesecake",
          "tiramisu",
          "mousse",
          "pudding",
          "sweet",
          "tart",
        ],
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

            item.category = newCategory;
            recategorizedCount++;
          }
        }
      }

      if (recategorizedCount > 0) { /* Condition handled */ }

      // Step 3: Replace or Append mode
      let existingItems: DatabaseMenuItem[] = [];

      if (replaceMode) {
        // Delete all existing items
        const { error: deleteItemsError } = await supabase
          .from("menu_items")
          .delete()
          .eq("venue_id", normalizedVenueId);

        if (deleteItemsError) {
          throw new Error(`Failed to delete old items: ${deleteItemsError.message}`);
        }
      } else {
        // Append mode - fetch existing items to merge with new ones
        const { data: existingData, error: fetchError } = await supabase
          .from("menu_items")
          .select("*")
          .eq("venue_id", normalizedVenueId);

        if (fetchError) {
          throw new Error(`Failed to fetch existing items: ${fetchError.message}`);
        }

        existingItems = existingData || [];
      }

      // In append mode, also include existing categories from database for better categorization
      if (!replaceMode && existingItems.length > 0) {
        const dbCategories = Array.from(
          new Set(
            existingItems
              .map((item) => item.category)
              .filter((c): c is string => Boolean(c) && c !== "Menu Items")
          )
        );
        existingCategories = Array.from(new Set([...existingCategories, ...dbCategories]));
      }

      // Step 4: Prepare items for database
      let finalItems;

      if (replaceMode) {
        // Replace mode: just use extracted items
        finalItems = extractionResult.items.map((item, i) => {
          const itemId = uuidv4();

          // Convert spice level string to integer for database
          let spiceLevelInt = null;
          if (item.spiceLevel === "mild") spiceLevelInt = 1;
          else if (item.spiceLevel === "medium") spiceLevelInt = 2;
          else if (item.spiceLevel === "hot") spiceLevelInt = 3;

          return {
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
          };
        });
      } else {
        // Append mode: intelligently merge existing items with newly extracted items
        finalItems = await mergeItemsIntelligently(existingItems, extractionResult.items, normalizedVenueId);
      }

      // Step 5: Insert into database

      if (finalItems.length > 0) {

        const { data, error: insertItemsError } = await supabase
          .from("menu_items")
          .upsert(finalItems, {
            onConflict: "id",
            ignoreDuplicates: false
          })
          .select();

        if (insertItemsError) {

          throw new Error(`Failed to insert items: ${insertItemsError.message}`);
        }

      } else { /* Else case handled */ }

      const duration = Date.now() - startTime;

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

      } catch (revalidateError) { /* Error handled silently */ }

      // STEP 7: Return success response
      return NextResponse.json({
        ok: true,
        message: replaceMode ? "Menu replaced successfully" : "Menu items combined successfully",
        items: finalItems.length,
        mode: extractionResult.mode,
        duration: `${duration}ms`,
      });
    } catch (_error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;
      const errorName = _error instanceof Error ? _error.name : "UnknownError";

      // Enhanced error logging

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

          try {
            // Clone request to avoid consuming original body
            const clonedReq = req.clone();
            const formData = await clonedReq.formData();
            venueId =
              (formData.get("venue_id") as string) || (formData.get("venueId") as string) || null;
          } catch (formDataError) {

            // venueId remains null - will need to be extracted in main handler
          }
        }

        // Ensure extracted venueId is normalized before returning
        const normalized = venueId
          ? venueId.startsWith("venue-")
            ? venueId
            : `venue-${venueId}`
          : null;

        return normalized;
      } catch (error) {

        return null;
      }
    },
  }
);
