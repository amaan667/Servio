import { NextRequest, NextResponse } from "next/server";
import { apiErrors } from "@/lib/api/standard-response";
import { createUnifiedHandler } from "@/lib/api/unified-handler";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

import OpenAI from "openai";
import { env } from "@/lib/env";

// Force Node.js runtime (required for Playwright)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Browser instance cache for reuse across requests
 */

let browserInstance: import("playwright-core").Browser | null = null;

/**
 * Get or create browser instance with Playwright
 */
async function getBrowser() {
  if (!browserInstance) {
    try {
      // Dynamic import - only loaded at runtime, not during build
      const playwright = await import("playwright-core");

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
          `1. Chromium is not installed (will auto-install on first use)\n` +
          `2. Missing system dependencies\n` +
          `3. Insufficient memory/resources\n\n` +
          `Error: ${launchError instanceof Error ? launchError.message : "Unknown error"}`
      );
    }
  }
  return browserInstance;
}

/**
 * Detect site type and determine scraping strategy
 */
async function detectSiteType(url: string): Promise<{
  type: "static" | "spa" | "ssr" | "lazy" | "unknown";
  needsJS: boolean;
  needsScroll: boolean;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    const html = await response.text();
    const lowerHtml = html.toLowerCase();
    const htmlLength = html.length;

    // Check for static content (server-rendered with menu already in HTML)
    const hasMenuContent = /menu|price|£|\$\d+\.\d{2}/i.test(html);
    const hasPrices = /\£|\$|€|\d+\.\d{2}/.test(html);

    // SPA indicators (needs JS rendering)
    const spaIndicators = [
      lowerHtml.includes("loading..."),
      lowerHtml.includes("spa-root"),
      lowerHtml.includes("app-root"),
      lowerHtml.includes("vue"),
      lowerHtml.includes("angular"),
      htmlLength < 5000 && !hasMenuContent,
    ];

    // SSR indicators (Next.js, Nuxt, etc. - may have embedded data)
    const ssrIndicators = [
      lowerHtml.includes("__next_data__"),
      lowerHtml.includes("__nuxt"),
      lowerHtml.includes("next.js"),
      html.includes("<!-- SSR -->"),
    ];

    // Lazy loading indicators
    const lazyIndicators = [
      lowerHtml.includes("lazy"),
      lowerHtml.includes("infinite-scroll"),
      lowerHtml.includes("load-more"),
      html.includes("data-lazy"),
    ];

    const isSPA = spaIndicators.filter(Boolean).length >= 2;
    const isSSR = ssrIndicators.filter(Boolean).length >= 1;
    const hasLazy = lazyIndicators.filter(Boolean).length >= 1;

    // Determine strategy
    if (hasMenuContent && hasPrices && htmlLength > 10000) {
      // Static HTML with menu already present
      return { type: "static", needsJS: false, needsScroll: false };
    } else if (isSSR && hasMenuContent) {
      // SSR with content available
      return { type: "ssr", needsJS: true, needsScroll: false };
    } else if (hasLazy || !hasMenuContent) {
      // Needs scrolling to load content
      return { type: "lazy", needsJS: true, needsScroll: true };
    } else if (isSPA) {
      // Full SPA, needs JS rendering
      return { type: "spa", needsJS: true, needsScroll: true };
    }

    // Default: assume needs JS but no scroll if content seems present
    return {
      type: "unknown",
      needsJS: !hasMenuContent,
      needsScroll: !hasMenuContent || hasLazy,
    };
  } catch {
    // If fetch fails, assume it needs full JS rendering
    return { type: "unknown", needsJS: true, needsScroll: true };
  }
}

/**
 * Smart scrape with Playwright
 * Uses the right strategy based on site type
 */
async function scrapeWithPlaywright(
  url: string,
  siteType: { type: string; needsJS: boolean; needsScroll: boolean }
) {
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

    // Navigate with smart wait strategy
    await page.goto(url, {
      waitUntil: "domcontentloaded", // Don't wait for networkidle - causes timeouts
      timeout: 15000, // Shorter timeout
    });

    // Quick cookie dismissal (non-blocking)
    await page
      .click('button:has-text("Accept"), button:has-text("Agree"), button:has-text("OK")', {
        timeout: 2000,
      })
      .catch(() => {
        /* Ignore - cookies already dismissed or not present */
      });

    // Strategy-based content loading
    if (siteType.needsJS) {
      // Wait for content to appear if JS rendering needed
      try {
        await page.waitForSelector(
          'main, article, [role="main"], .menu, .menu-item, [class*="menu"], [id*="menu"], .content, body > *',
          { timeout: 10000 }
        );
      } catch {
        // Continue even if selector doesn't match
      }
    }

    // Handle lazy-loaded content with progressive scrolling
    if (siteType.needsScroll) {
      await page.evaluate(async () => {
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        let scrolled = 0;

        // Progressive scroll to trigger lazy loading
        while (scrolled < scrollHeight) {
          window.scrollTo(0, scrolled);
          scrolled += viewportHeight;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // Scroll back to top
        window.scrollTo(0, 0);
      });

      // Wait for lazy-loaded content to render
      await page.waitForTimeout(2000);
    }

    // Verify menu content exists
    const hasMenuContent = await page.evaluate(() => {
      const bodyText = document.body.innerText || "";
      const hasPrices = /\$|\£|€|\d+\.\d{2}/.test(bodyText);
      const hasFoodWords = /menu|item|dish|food|breakfast|lunch|dinner|price|£/i.test(bodyText);
      const hasEnoughContent = bodyText.length > 200;
      return hasPrices && hasFoodWords && hasEnoughContent;
    });

    // If still no content and not static, try one more scroll
    if (!hasMenuContent && siteType.type !== "static") {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1500);
    }

    // Get HTML
    const html = await page.content();

    // Extract text (remove scripts/styles/nav/footer for cleaner extraction)
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      // Remove non-content elements
      clone
        .querySelectorAll("script, style, noscript, nav, footer, header, .nav, .footer, .header")
        .forEach((el) => el.remove());
      const mainContent =
        clone.querySelector("main, article, [role='main'], .content, .main-content") || clone;
      return (mainContent as HTMLElement).innerText || (clone as HTMLElement).innerText;
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
    if (page)
      await page.close().catch(() => {
        /* Empty */
      });
    if (context)
      await context.close().catch(() => {
        /* Empty */
      });
  }
}

const scrapeMenuSchema = z.object({
  url: z.string().url("A valid URL is required"),
});

function isSafeScrapeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    ) {
      return false;
    }

    // Reject obvious private IPv4 ranges to reduce SSRF risk.
    if (
      /^(10\\.|127\\.|169\\.254\\.|172\\.(1[6-9]|2\\d|3[0-1])\\.|192\\.168\\.)/.test(host)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Scrape Menu from URL using Playwright
 * Self-hosted browser automation - fast, free, and reliable
 * Optimized for JS-heavy sites like Cafe Nur
 */
export const POST = createUnifiedHandler(
  async (_req: NextRequest, context) => {
    const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

    if (process.env.ENABLE_MENU_SCRAPING !== "true") {
      return apiErrors.notFound("Not found");
    }

    const { url } = context.body as z.infer<typeof scrapeMenuSchema>;
    if (!isSafeScrapeUrl(url)) {
      return apiErrors.badRequest("URL is not allowed");
    }

    try {
    // Detect site type for optimal strategy
    const siteType = await detectSiteType(url);

    // Scrape with strategy optimized for site type
    const { text: finalText, images: imageUrls } = await scrapeWithPlaywright(url, siteType);

    if (!finalText || finalText.length < 50) {
      const errorResponse = {
        ok: false,
        error:
          "Unable to extract meaningful content from the URL. The page may be empty, protected, require authentication, or use a format we don't support yet.",
        suggestions: [
          "Try checking if the menu is behind a login",
          "Verify the URL is publicly accessible",
          "Check if the menu is in a PDF or image format",
          "Ensure the page loads menu content on initial render",
        ],
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

    // Initialize OpenAI client inside function to avoid build-time errors
    const openai = new OpenAI({ apiKey: env("OPENAI_API_KEY") });

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

      if (menuItems.length === 0) {
        /* Empty */
      } else {
        // Log first 10 items in detail (items logged for debugging)
        const itemsToShow = Math.min(10, menuItems.length);
        for (let i = 0; i < itemsToShow; i++) {
          void menuItems[i]; // Acknowledge items exist
        }

        if (menuItems.length > 10) {
          /* Empty */
        }

        void Array.from(new Set(menuItems.map((i: { category: string }) => i.category))); // Categories calculated for future use
      }
    } catch (parseError) {
      throw new Error("AI returned invalid JSON");
    }

    const totalDuration = Date.now() - startTime;
    void totalDuration;
    void requestId;

    const successResponse = {
      ok: true,
      items: menuItems,
      message: `Found ${menuItems.length} items from menu`,
    };

    return NextResponse.json(successResponse);
    } catch (_error) {
      const errorResponse = {
        ok: false,
        error: _error instanceof Error ? _error.message : "Failed to scrape menu",
      };

      return NextResponse.json(errorResponse, { status: 500 });
    }
  },
  {
    schema: scrapeMenuSchema,
    requireAuth: true,
    requireVenueAccess: false,
    rateLimit: RATE_LIMITS.STRICT,
  }
);
