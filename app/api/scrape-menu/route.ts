import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Force Node.js runtime (required for Playwright)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scrape Menu from URL using Playwright
 * Self-hosted browser automation - fast, free, and reliable
 * Optimized for JS-heavy sites like Cafe Nur
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ ok: false, error: "URL is required" }, { status: 400 });
    }

    console.info(`🌐 [SCRAPE MENU ${requestId}] Scraping: ${url}`);
    logger.info(`[MENU SCRAPE] Starting scrape`, { url, requestId });

    // Use Playwright smart scraping (tries fast first, falls back to networkidle)
    console.info(`🚀 [SCRAPE MENU ${requestId}] Using Playwright with smart retry...`);

    // Dynamic import to avoid bundling playwright-core in the client
    const { smartScrape } = await import("@/lib/playwright-scraper");
    const { text: finalText, images: imageUrls } = await smartScrape(url);

    if (!finalText || finalText.length < 50) {
      console.error(`❌ [SCRAPE MENU ${requestId}] Insufficient content extracted`);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to extract meaningful content from the URL. The page may be empty, protected, or require authentication.",
        },
        { status: 400 }
      );
    }

    console.info(`✅ [SCRAPE MENU ${requestId}] Content extracted successfully`);
    console.info(
      `📊 [SCRAPE MENU ${requestId}] Stats: ${finalText.length} chars, ${imageUrls.length} images`
    );
    console.info(`📝 [SCRAPE MENU ${requestId}] Preview: ${finalText.substring(0, 300)}...`);

    // Use GPT-4 to extract menu items
    console.info(`🤖 [SCRAPE MENU ${requestId}] Using AI to extract menu items...`);

    const truncatedText =
      finalText.length > 30000 ? finalText.substring(0, 30000) + "..." : finalText;

    const extractionPrompt = `Extract ALL menu items from this restaurant menu text.

Menu Text:
${truncatedText}

Available Images:
${imageUrls.slice(0, 50).join("\n")}

Extract each menu item with:
- name: Item name (required)
- price: Price as number (extract from £X.XX or $X.XX patterns)
- description: Item description (if available)
- category: Category/section (e.g. "Breakfast", "Mains", "Desserts")
- image: Match an image URL if relevant

Return ONLY valid JSON:
{
  "items": [
    {
      "name": "Eggs Benedict",
      "price": 12.50,
      "description": "Poached eggs with hollandaise",
      "category": "Breakfast",
      "image": "https://example.com/eggs.jpg"
    }
  ]
}`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a menu extraction expert. Extract ALL menu items. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: extractionPrompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const aiContent = aiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error("AI response was empty");
    }

    let menuItems;
    try {
      const parsed = JSON.parse(aiContent);
      menuItems = parsed.items || [];
    } catch (parseError) {
      console.error(`❌ [SCRAPE MENU ${requestId}] Failed to parse AI response:`, parseError);
      throw new Error("AI returned invalid JSON");
    }

    console.info(`✅ [SCRAPE MENU ${requestId}] Extracted ${menuItems.length} items`);
    logger.info("[MENU SCRAPE] Extraction complete", { itemCount: menuItems.length });

    return NextResponse.json({
      ok: true,
      items: menuItems,
      message: `Found ${menuItems.length} items from menu`,
    });
  } catch (error) {
    console.error(`❌ [SCRAPE MENU ${requestId}] Error:`, error);
    logger.error("[MENU SCRAPE] Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to scrape menu",
      },
      { status: 500 }
    );
  }
}
