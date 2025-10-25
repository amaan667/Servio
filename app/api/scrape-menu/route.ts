import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Force Node.js runtime (required for Playwright)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Browser instance cache for reuse across requests
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browserInstance: any = null;

/**
 * Get or create browser instance with Playwright
 */
async function getBrowser() {
  if (!browserInstance) {
    // Dynamic import - only loaded at runtime, not during build
    const playwright = await import("playwright-core");

    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    console.info(
      `🌐 Launching browser${executablePath ? ` from ${executablePath}` : " (auto-detect)"}`
    );

    browserInstance = await playwright.chromium.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
      ],
    });

    console.info("✅ Browser launched successfully");
  }
  return browserInstance;
}

/**
 * Smart scrape with Playwright
 * Tries fast approach first, falls back to networkidle for JS-heavy sites
 */
async function scrapeWithPlaywright(url: string, waitForNetworkIdle: boolean = false) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });

  const page = await context.newPage();

  try {
    // Navigate
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "domcontentloaded",
      timeout: waitForNetworkIdle ? 30000 : 20000,
    });

    // Wait for JS to settle
    await page.waitForTimeout(waitForNetworkIdle ? 2000 : 1000);

    // Try to wait for common menu selectors
    await page
      .waitForSelector('main, [class*="menu"], [class*="item"], [role="main"]', {
        timeout: 5000,
      })
      .catch(() => {
        // Selector not found, continue anyway
      });

    // Get HTML
    const html = await page.content();

    // Extract text (remove scripts/styles)
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
      return clone.innerText;
    });

    // Extract images
    const images = await page.evaluate((baseUrl: string) => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs
        .map((img) => {
          let src = img.src || img.dataset.src || img.dataset.lazySrc;
          if (src && !src.startsWith("http")) {
            try {
              src = new URL(src, baseUrl).href;
            } catch {
              return null;
            }
          }
          return src && src.startsWith("http") ? src : null;
        })
        .filter((src): src is string => src !== null);
    }, url);

    return { html, text, images };
  } finally {
    await page.close();
    await context.close();
  }
}

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

    // Try fast scrape first
    console.info(`🚀 [SCRAPE MENU ${requestId}] Trying fast scrape...`);

    let finalText: string;
    let imageUrls: string[];

    try {
      const result = await scrapeWithPlaywright(url, false);

      // Validate we got meaningful content
      if (result.text.length > 500) {
        console.info(`✅ [SCRAPE MENU ${requestId}] Fast scrape successful`);
        finalText = result.text;
        imageUrls = result.images;
      } else {
        throw new Error("Insufficient content - trying with networkidle");
      }
    } catch {
      // Fallback to networkidle for JS-heavy sites
      console.info(
        `⚠️ [SCRAPE MENU ${requestId}] Fast scrape failed, retrying with networkidle...`
      );
      const result = await scrapeWithPlaywright(url, true);
      finalText = result.text;
      imageUrls = result.images;
    }

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
