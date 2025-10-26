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
    try {
      // Dynamic import - only loaded at runtime, not during build
      const playwright = await import("playwright-core");

      // Check if Chromium is installed
      const browserPaths = [
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        "/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
      ].filter(Boolean);

      browserInstance = await playwright.chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--single-process", // Important for Railway
          "--no-zygote",
        ],
        timeout: 30000, // 30s timeout for launch
      });

    } catch (launchError) {

      // Don't crash - throw error to be caught by API handler
      throw new Error(
        `Playwright browser failed to launch. This usually means:\n` +
          `1. Chromium is not installed (run: npx playwright install chromium)\n` +
          `2. Missing system dependencies\n` +
          `3. Insufficient memory/resources\n\n` +
          `Error: ${launchError instanceof Error ? launchError.message : "Unknown error"}`
      );
    }
  }
  return browserInstance;
}

/**
 * Quick detection: Is this a JS-heavy site?
 * Fetches HTML and checks for common JS framework indicators
 */
async function detectJSHeavySite(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const html = await response.text();
    const lowerHtml = html.toLowerCase();

    // Check for JS framework indicators
    const indicators = [
      lowerHtml.includes("loading..."),
      lowerHtml.includes("__next_data__"),
      lowerHtml.includes("__nuxt"),
      lowerHtml.includes("react"),
      lowerHtml.includes("vue"),
      lowerHtml.includes("angular"),
      html.length < 5000, // Very minimal HTML
      lowerHtml.includes("spa-root"),
      lowerHtml.includes("app-root"),
    ];

    const jsIndicatorCount = indicators.filter(Boolean).length;
    const isJSHeavy = jsIndicatorCount >= 2;

    return isJSHeavy;
  } catch {
    // If fetch fails, assume it needs JS rendering
    return true;
  }
}

/**
 * Smart scrape with Playwright
 * Uses the right strategy based on site type
 */
async function scrapeWithPlaywright(url: string, waitForNetworkIdle: boolean = false) {

  let browser;
  let context;
  let page;

  try {
    browser = await getBrowser();

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });

    page = await context.newPage();

    // Navigate
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "domcontentloaded",
      timeout: waitForNetworkIdle ? 30000 : 20000,
    });

    // SMART STRATEGY: Multi-approach content loading

    // Strategy 1: Check for Next.js embedded data (instant - no waiting!)
    const embeddedData = await page.evaluate(() => {
      // Check Next.js data
      const nextScript = document.getElementById("__NEXT_DATA__");
      if (nextScript?.textContent) {
        return { type: "NEXT_DATA", data: nextScript.textContent };
      }

      // Check for any JSON data in script tags
      const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
      for (const script of scripts) {
        if (script.textContent && script.textContent.includes("menu")) {
          return { type: "JSON_SCRIPT", data: script.textContent };
        }
      }

      return null;
    });

    if (embeddedData) {
    }

    // Strategy 2: FAST extraction - no waiting!

    // Quick cookie dismissal (don't wait)
    await page
      .click('button:has-text("Accept"), button:has-text("Agree")', { timeout: 1000 })
      .catch(() => {});

    // Single scroll to trigger lazy content (no waiting)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

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
  } catch (scrapeError) {
    throw scrapeError;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

/**
 * Scrape Menu from URL using Playwright
 * Self-hosted browser automation - fast, free, and reliable
 * Optimized for JS-heavy sites like Cafe Nur
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ ok: false, error: "URL is required" }, { status: 400 });
    }

    logger.info(`[MENU SCRAPE] Starting scrape`, { url, requestId });

    // Smart detection: Determine site type FIRST (saves 20s for JS sites!)
    const isJSHeavy = await detectJSHeavySite(url);

    if (isJSHeavy) {
    } else {
      // Intentionally empty
    }

    // Scrape with the right strategy from the start
    const scrapeStart = Date.now();
    const { text: finalText, images: imageUrls } = await scrapeWithPlaywright(url, isJSHeavy);
    const scrapeDuration = Date.now() - scrapeStart;

    if (!finalText || finalText.length < 50) {
      const errorResponse = {
        ok: false,
        error:
          "Unable to extract meaningful content from the URL. The page may be empty, protected, or require authentication.",
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Use GPT-4 to extract menu items

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

    const aiStart = Date.now();

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

    const aiDuration = Date.now() - aiStart;

    const aiContent = aiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error("AI response was empty");
    }

    let menuItems;
    try {
      const parsed = JSON.parse(aiContent);
      menuItems = parsed.items || [];

      if (menuItems.length === 0) {
      } else {

        // Log first 10 items in detail
        const itemsToShow = Math.min(10, menuItems.length);
        for (let i = 0; i < itemsToShow; i++) {
          const item = menuItems[i];
        }

        if (menuItems.length > 10) {
        }

        const categories = Array.from(new Set(menuItems.map((i) => i.category)));
      }
    } catch (parseError) {
      throw new Error("AI returned invalid JSON");
    }

    const totalDuration = Date.now() - startTime;
    logger.info("[MENU SCRAPE] Extraction complete", {
      itemCount: menuItems.length,
      duration: totalDuration,
    });

    const successResponse = {
      ok: true,
      items: menuItems,
      message: `Found ${menuItems.length} items from menu`,
    };

    return NextResponse.json(successResponse);
  } catch (_error) {
    const totalDuration = Date.now() - startTime;

    logger.error("[MENU SCRAPE] Error:", error);

    const errorResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to scrape menu",
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
