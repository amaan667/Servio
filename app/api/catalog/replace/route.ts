import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
import { createServerSupabase } from "@/lib/supabase";
import { extractMenuHybrid } from "@/lib/hybridMenuExtractor";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { isDevelopment } from "@/lib/env";

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

      .toISOString(),

      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const menuUrl = formData.get("menu_url") as string | null;
      const replaceMode = formData.get("replace_mode") !== "false"; // Default to true

      

      // VALIDATION: Must have at least one source (PDF or URL)
      if (!file && !menuUrl) {
        return NextResponse.json(
          {

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

      

      // Step 1: Convert PDF to images (if PDF provided)
      let pdfImages: string[] | undefined;

      if (file) {
        const pdfBuffer = Buffer.from(await file.arrayBuffer());

        try {
          const { convertPDFToImages } = await import("@/lib/pdf-to-images-serverless");
          pdfImages = await convertPDFToImages(pdfBuffer);
          
        } catch (conversionError) {
          
          throw new Error("PDF conversion failed. Please check file format.");
        }

        // Store PDF images in database
        try {
          const { error: uploadError } = await supabase.from("menu_uploads").insert({

          if (uploadError) {
            
          }
        } catch {
          
        }
      }

      // Step 2: Hybrid Extraction (handles all 3 modes automatically)

      let extractionResult;
      try {
        

        extractionResult = await extractMenuHybrid({
          pdfImages,

      } catch (extractionError) {

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

       => item.category === "Menu Items")
          .length,

      // Enhanced category keyword mapping for intelligent recategorization
      const categoryKeywordMap: { [key: string]: string[] } = {

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

          "espresso",
          "latte",
          "cappuccino",
          "americano",
          "mocha",
          "flat white",
          "cortado",
        ],
        tea: ["tea", "chai", "matcha", "oolong", "green tea", "earl grey", "chamomile"],

          "smoothie",
          "water",
          "soda",
          "drink",
          "beverage",
          "lemonade",
          "milkshake",
        ],

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

      if (recategorizedCount > 0) {
         => item.category))
            ),
          }
        );
      }

      // Step 3: Replace or Append mode
      if (replaceMode) {
        .toISOString(),

        // Delete all existing items
        const { error: deleteItemsError } = await supabase
          .from("menu_items")
          .delete()
          .eq("venue_id", normalizedVenueId);

        

        if (deleteItemsError) {
          
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

      }

      // Step 5: Insert into database
      

      if (menuItems.length > 0) {
        
        

        const { data, error: insertItemsError } = await supabase
          .from("menu_items")
          .insert(menuItems)
          .select();

        

        if (insertItemsError) {
          
          throw new Error(`Failed to insert items: ${insertItemsError.message}`);
        }

        
      } else {
        
      }

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

        
      } catch (revalidateError) {
        `,
          revalidateError
        );
      }

      

      // STEP 7: Return success response
      return NextResponse.json({

        duration: `${duration}ms`,

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

          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {

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

        const { searchParams } = new URL(req.url);
        let venueId = searchParams.get("venueId") || searchParams.get("venue_id");

        if (!venueId) {
          // Fallback: Try to read from formData (this will consume the body, so it's a last resort)
          // In practice, venueId should be in query params to avoid this issue
          "
          );
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

        return normalized;
      } catch (error) {

        return null;
      }
    },
  }
);
