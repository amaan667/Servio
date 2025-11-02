import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { extractMenuFromImage } from "@/lib/gptVisionMenuParser";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ScrapedMenuItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string | null;
}

interface PDFMenuItem {
  name: string;
  description?: string;
  price: number;
  category: string;
  page: number;
}

/**
 * Re-process existing PDF images with new URL
 * Uses PDF images already in database - no re-upload needed
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const body = await req.json();
    const {
      venue_id: venueId,
      menu_url: menuUrl,
      pdf_images: pdfImages,
      replace_mode: replaceMode,
    } = body;

    if (!venueId || !menuUrl || !pdfImages || pdfImages.length === 0) {
      return NextResponse.json(
        { ok: false, error: "venue_id, menu_url, and pdf_images required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Step 1: Scrape URL for item data using centralized API
    let urlItems: ScrapedMenuItem[] = [];
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
          : "http://localhost:3000");

      // Create AbortController with 120s timeout (Playwright with scrolling can take 60-90s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      let scrapeResponse;
      try {
        scrapeResponse = await fetch(`${baseUrl}/api/scrape-menu`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: menuUrl }),
          signal: controller.signal,
          // @ts-expect-error - Node.js fetch specific options
          headersTimeout: 120000,
          bodyTimeout: 120000,
        });
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
        ok: boolean;
        items?: Array<{
          name: string;
          description?: string;
          price?: number;
          category?: string;
          image?: string;
        }>;
        error?: string;
      };
      if (scrapeResult.ok && scrapeResult.items) {
        urlItems = scrapeResult.items.map((item) => ({
          name: item.name,
          description: item.description || "",
          price: item.price || 0,
          category: item.category || "Menu Items",
          image_url: item.image || null,
        }));
      } else {
        throw new Error(scrapeResult.error || "Scraping returned no items");
      }
    } catch (_error) {
      logger.warn(`[REPROCESS ${requestId}] URL scraping failed, falling back to PDF-only`);
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
        id: itemId,
        venue_id: venueId,
        name: urlItem.name,
        description: urlItem.description || pdfMatch?.description || "",
        price: urlItem.price || pdfMatch?.price || 0,
        category: urlItem.category || pdfMatch?.category || "Menu Items",
        image_url: urlItem.image_url || null,
        is_available: true,
        created_at: new Date().toISOString(),
      });

      combinedItems.set(urlItem.name.toLowerCase(), true);
    }

    // Add PDF items not in URL
    for (const pdfItem of pdfExtractedItems) {
      if (!combinedItems.has(pdfItem.name.toLowerCase())) {
        const itemId = uuidv4();

        menuItems.push({
          id: itemId,
          venue_id: venueId,
          ...pdfItem,
          is_available: true,
          created_at: new Date().toISOString(),
        });
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
      ok: true,
      result: {
        items_created: menuItems.length,
        categories_created: new Set(menuItems.map((i) => i.category)).size,
      },
    });
  } catch (_err) {
    const errorMessage = _err instanceof Error ? _err.message : "Processing failed";
    logger.error(`[REPROCESS ${requestId}] Error:`, { error: errorMessage });
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}

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
