import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { extractMenuFromImage } from "@/lib/gptVisionMenuParser";
import { v4 as uuidv4 } from "uuid";
import { withUnifiedAuth } from "@/lib/auth/unified-auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { env, isDevelopment } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ScrapedMenuItem {

}

interface PDFMenuItem {

}

/**
 * Re-process existing PDF images with new URL
 * Uses PDF images already in database - no re-upload needed
 */
export const POST = withUnifiedAuth(
  async (req: NextRequest, context) => {
    const requestId = Math.random().toString(36).substring(7);

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

      // STEP 3: Parse request
      const body = await req.json();
      const { menu_url: menuUrl, pdf_images: pdfImages, replace_mode: replaceMode } = body;

      // STEP 4: Validate inputs
      if (!venueId || !menuUrl || !pdfImages || pdfImages.length === 0) {
        return NextResponse.json(
          { ok: false, error: "venue_id, menu_url, and pdf_images required" },
          { status: 400 }
        );
      }

      // STEP 5: Security - Verify venue access (already done by withUnifiedAuth)

      // STEP 6: Business logic
      const supabase = await createClient();

      // Step 1: Scrape URL for item data using centralized API
      let urlItems: ScrapedMenuItem[] = [];
      try {
        const railwayDomain = env("RAILWAY_PUBLIC_DOMAIN");
        const baseUrl =
          env("NEXT_PUBLIC_APP_URL") ||
          (railwayDomain
            ? `https://${railwayDomain.replace(/^https?:\/\//, "")}`

        const timeoutId = setTimeout(() => controller.abort(), 120000);

        let scrapeResponse;
        try {
          scrapeResponse = await fetch(`${baseUrl}/api/scrape-menu`, {

            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: menuUrl }),

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

          }>;
          error?: string;
        };
        if (scrapeResult.ok && scrapeResult.items) {
          urlItems = scrapeResult.items.map((item) => ({

          }));
        } else {
          throw new Error(scrapeResult.error || "Scraping returned no items");
        }
      } catch (_error) {
        
        // Continue with PDF-only extraction
      }

      // Step 2: Extract items from existing PDF images
      const pdfExtractedItems: PDFMenuItem[] = [];

      for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
        const extractedItems = await extractMenuFromImage(pdfImages[pageIndex]);
        pdfExtractedItems.push(...extractedItems.map((item) => ({ ...item, page: pageIndex })));
      }

      // Step 3: Combine data
      const menuItems = [];
      const combinedItems = new Map();

      // Start with URL items (better quality data)
      for (const urlItem of urlItems) {
        const itemId = uuidv4();

        const pdfMatch = pdfExtractedItems.find(
          (pdfItem) => calculateSimilarity(urlItem.name, pdfItem.name) > 0.7
        );

        menuItems.push({

        combinedItems.set(urlItem.name.toLowerCase(), true);
      }

      // Add PDF items not in URL
      for (const pdfItem of pdfExtractedItems) {
        if (!combinedItems.has(pdfItem.name.toLowerCase())) {
          const itemId = uuidv4();

          menuItems.push({

            ...pdfItem,

        }
      }

      // Step 4: Replace or Append
      if (replaceMode) {
        await supabase.from("menu_items").delete().eq("venue_id", venueId);
      } else {
        // Intentionally empty
      }

      // Step 5: Insert
      if (menuItems.length > 0) {
        const { error: insertError } = await supabase.from("menu_items").insert(menuItems);
        if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
      }

      return NextResponse.json({

        },

    } catch (_error) {
      const errorMessage =
        _error instanceof Error ? _error.message : "An unexpected error occurred";
      const errorStack = _error instanceof Error ? _error.stack : undefined;

      

      if (errorMessage.includes("Unauthorized") || errorMessage.includes("Forbidden")) {
        return NextResponse.json(
          {

          },
          { status: errorMessage.includes("Unauthorized") ? 401 : 403 }
        );
      }

      return NextResponse.json(
        {

          ...(isDevelopment() && errorStack ? { stack: errorStack } : {}),
        },
        { status: 500 }
      );
    }
  },
  {
    // Extract venueId from body

      } catch {
        return null;
      }
    },
  }
);

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

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
