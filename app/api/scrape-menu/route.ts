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
      console.info(`📦 Importing playwright-core...`);
      const playwright = await import("playwright-core");
      console.info(`✅ playwright-core imported`);

      console.info(`🌐 Launching Playwright Chromium...`);

      // Check if Chromium is installed
      const browserPaths = [
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        "/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
      ].filter(Boolean);

      console.info(`🔍 Looking for Chromium in:`, browserPaths);

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

      console.info("✅ Browser launched successfully");
    } catch (launchError) {
      console.error(`❌ Failed to launch browser:`, launchError);
      console.error(`Error details:`, {
        message: launchError instanceof Error ? launchError.message : String(launchError),
        stack: launchError instanceof Error ? launchError.stack : undefined,
      });

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
    console.info(`🔍 Fetching initial HTML to detect site type...`);
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

    console.info(`📊 JS indicators: ${jsIndicatorCount}/9 → ${isJSHeavy ? "JS-heavy" : "Static"}`);
    return isJSHeavy;
  } catch {
    // If fetch fails, assume it needs JS rendering
    console.info(`⚠️ Initial fetch failed → Assuming JS-heavy`);
    return true;
  }
}

/**
 * Smart scrape with Playwright
 * Uses the right strategy based on site type
 */
async function scrapeWithPlaywright(url: string, waitForNetworkIdle: boolean = false) {
  console.info(
    `📡 Scrape config: networkIdle=${waitForNetworkIdle}, timeout=${waitForNetworkIdle ? 30 : 20}s`
  );

  let browser;
  let context;
  let page;

  try {
    browser = await getBrowser();
    console.info(`✅ Browser instance obtained`);

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    console.info(`✅ Browser context created`);

    page = await context.newPage();
    console.info(`✅ New page created`);

    // Navigate
    console.info(`🌐 Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "domcontentloaded",
      timeout: waitForNetworkIdle ? 30000 : 20000,
    });
    console.info(`✅ Page loaded`);

    // SMART STRATEGY: Multi-approach content loading
    console.info(`🧠 Using smart content loading strategies...`);

    // Strategy 1: Check for Next.js embedded data (instant - no waiting!)
    console.info(`📦 Strategy 1: Checking for __NEXT_DATA__ or embedded JSON...`);
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
      console.info(
        `✅ Found embedded data (${embeddedData.type}): ${embeddedData.data.length} chars`
      );
    }

    // Strategy 2: Aggressive wait for menu content (give React time to render)
    console.info(`🎯 Strategy 2: Waiting for menu content to fully render...`);

    // First, dismiss any cookie popups
    await page
      .click(
        'button:has-text("Accept"), button:has-text("Agree"), [class*="accept"], [class*="cookie"]',
        {
          timeout: 2000,
        }
      )
      .catch(() => console.info(`✅ No cookie popup`));

    // Wait longer for React/Next.js to fully hydrate and render menu
    console.info(`⏳ Giving React 5 seconds to fully render menu content...`);
    await page.waitForTimeout(5000);

    // Now look for menu items with VERY broad selectors
    const menuAppeared = await page
      .waitForSelector(
        // Try multiple possible structures
        '[class*="menu"], [class*="Menu"], [class*="item"], [class*="Item"], ' +
          '[class*="product"], [class*="Product"], [class*="card"], [class*="Card"], ' +
          'img[alt*="menu"], img[alt*="food"], img[src*="food"], h3, h4, h2',
        { timeout: 10000 }
      )
      .then(async () => {
        console.info(`✅ Content elements detected!`);

        // Do one scroll to bottom to trigger any remaining lazy content
        console.info(`📜 Single scroll to trigger remaining content...`);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(4000); // Wait 4s for content to load

        return true;
      })
      .catch(() => {
        console.warn(`⚠️ No standard menu elements found, will extract raw content`);
        return false;
      });

    // Strategy 3: Analyze page structure to find menu content
    if (!menuAppeared && !embeddedData) {
      console.info(`🔍 Strategy 3: Analyzing page structure...`);

      const pageAnalysis = await page.evaluate(() => {
        // Find all elements with menu-related content
        const allDivs = document.querySelectorAll("div, section, ul, li");
        const menuLikeElements: string[] = [];

        allDivs.forEach((el) => {
          const className = el.className?.toString() || "";
          const id = el.id || "";
          const text = el.textContent || "";

          // Look for elements that might contain menu items
          if (
            className.toLowerCase().includes("item") ||
            className.toLowerCase().includes("card") ||
            className.toLowerCase().includes("product") ||
            text.includes("£") ||
            text.includes("$")
          ) {
            const preview = text.substring(0, 50).replace(/\s+/g, " ");
            if (preview.length > 10 && !menuLikeElements.includes(preview)) {
              menuLikeElements.push(`${className || id || "div"}: ${preview}`);
            }
          }
        });

        return {
          title: document.title,
          bodyLength: document.body.innerText.length,
          bodyText: document.body.innerText.substring(0, 1000),
          hasMain: !!document.querySelector("main"),
          hasArticle: !!document.querySelector("article"),
          menuLikeElements: menuLikeElements.slice(0, 10),
          uniqueClasses: Array.from(
            new Set(
              Array.from(document.querySelectorAll("*"))
                .map((el) => el.className?.toString())
                .filter((c) => c && c.length > 0 && c.length < 50)
            )
          ).slice(0, 20),
        };
      });

      console.warn(`⚠️ Page Analysis:`);
      console.warn(`  Title: ${pageAnalysis.title}`);
      console.warn(`  Body length: ${pageAnalysis.bodyLength} chars`);
      console.warn(`  Body preview:`, pageAnalysis.bodyText.substring(0, 200));
      console.warn(`  Menu-like elements found: ${pageAnalysis.menuLikeElements.length}`);
      pageAnalysis.menuLikeElements.forEach((el, i) => {
        console.warn(`    ${i + 1}. ${el}`);
      });
      console.warn(`  Common classes:`, pageAnalysis.uniqueClasses.slice(0, 10).join(", "));
    }

    // Get HTML
    console.info(`📄 Extracting HTML...`);
    const html = await page.content();
    console.info(`✅ HTML extracted: ${html.length} chars`);

    // Extract text (remove scripts/styles)
    console.info(`📝 Extracting text content...`);
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
      return clone.innerText;
    });
    console.info(`✅ Text extracted: ${text.length} chars`);
    console.info(`📄 Text preview (first 500 chars):`, text.substring(0, 500));
    console.info(`📄 Text preview (chars 1000-1500):`, text.substring(1000, 1500));

    // Extract images
    console.info(`🖼️  Extracting images...`);
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
    console.info(`✅ Images extracted: ${images.length} found`);

    return { html, text, images };
  } catch (scrapeError) {
    console.error(`❌ Error during scraping:`, scrapeError);
    throw scrapeError;
  } finally {
    console.info(`🧹 Cleaning up page and context...`);
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    console.info(`✅ Cleanup complete`);
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

  console.info(`\n${"=".repeat(80)}`);
  console.info(`🚀 [SCRAPE MENU ${requestId}] NEW REQUEST STARTED`);
  console.info(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.info(`${"=".repeat(80)}\n`);

  try {
    console.info(`📥 [SCRAPE MENU ${requestId}] Parsing request body...`);
    const body = await req.json();
    const { url } = body;
    console.info(`✅ [SCRAPE MENU ${requestId}] Body parsed`);

    if (!url) {
      console.error(`❌ [SCRAPE MENU ${requestId}] No URL provided`);
      return NextResponse.json({ ok: false, error: "URL is required" }, { status: 400 });
    }

    console.info(`🌐 [SCRAPE MENU ${requestId}] Target URL: ${url}`);
    logger.info(`[MENU SCRAPE] Starting scrape`, { url, requestId });

    // Smart detection: Determine site type FIRST (saves 20s for JS sites!)
    console.info(`🔍 [SCRAPE MENU ${requestId}] Detecting site type...`);
    const isJSHeavy = await detectJSHeavySite(url);

    if (isJSHeavy) {
      console.info(
        `⚡ [SCRAPE MENU ${requestId}] JS-heavy site detected → Using networkidle directly (30s)`
      );
    } else {
      console.info(`⚡ [SCRAPE MENU ${requestId}] Static/light site → Using fast scrape (20s)`);
    }

    // Scrape with the right strategy from the start
    console.info(`🚀 [SCRAPE MENU ${requestId}] Starting Playwright scrape...`);
    const scrapeStart = Date.now();
    const { text: finalText, images: imageUrls } = await scrapeWithPlaywright(url, isJSHeavy);
    const scrapeDuration = Date.now() - scrapeStart;

    console.info(
      `✅ [SCRAPE MENU ${requestId}] Scraping complete in ${scrapeDuration}ms (${(scrapeDuration / 1000).toFixed(1)}s)`
    );
    console.info(
      `📊 [SCRAPE MENU ${requestId}] Extraction: ${finalText.length} chars, ${imageUrls.length} images`
    );

    if (!finalText || finalText.length < 50) {
      console.error(
        `❌ [SCRAPE MENU ${requestId}] Insufficient content: only ${finalText?.length || 0} chars`
      );
      const errorResponse = {
        ok: false,
        error:
          "Unable to extract meaningful content from the URL. The page may be empty, protected, or require authentication.",
      };
      console.info(`📤 [SCRAPE MENU ${requestId}] Sending error response:`, errorResponse);
      return NextResponse.json(errorResponse, { status: 400 });
    }

    console.info(`✅ [SCRAPE MENU ${requestId}] Content validation passed`);
    console.info(`📝 [SCRAPE MENU ${requestId}] Text preview: ${finalText.substring(0, 200)}...`);

    // Use GPT-4 to extract menu items
    console.info(`🤖 [SCRAPE MENU ${requestId}] Preparing AI extraction...`);
    console.info(
      `📏 [SCRAPE MENU ${requestId}] Text length: ${finalText.length} chars (will truncate to 30k if needed)`
    );

    const truncatedText =
      finalText.length > 30000 ? finalText.substring(0, 30000) + "..." : finalText;

    console.info(
      `✅ [SCRAPE MENU ${requestId}] Text prepared for AI (${truncatedText.length} chars)`
    );
    console.info(
      `🖼️  [SCRAPE MENU ${requestId}] Providing ${Math.min(imageUrls.length, 50)} image URLs to AI`
    );

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

    console.info(`📡 [SCRAPE MENU ${requestId}] Calling OpenAI GPT-4o...`);
    console.info(
      `📤 [SCRAPE MENU ${requestId}] Sending ${truncatedText.length} chars of text to AI`
    );
    console.info(
      `📸 [SCRAPE MENU ${requestId}] Sending ${imageUrls.slice(0, 50).length} image URLs to AI`
    );
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
    console.info(
      `✅ [SCRAPE MENU ${requestId}] AI response received in ${aiDuration}ms (${(aiDuration / 1000).toFixed(1)}s)`
    );

    const aiContent = aiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      console.error(`❌ [SCRAPE MENU ${requestId}] AI response was empty`);
      throw new Error("AI response was empty");
    }

    console.info(`📄 [SCRAPE MENU ${requestId}] AI content length: ${aiContent.length} chars`);

    let menuItems;
    try {
      console.info(`🔄 [SCRAPE MENU ${requestId}] Parsing AI JSON response...`);
      console.info(
        `📋 [SCRAPE MENU ${requestId}] AI response preview:`,
        aiContent.substring(0, 300)
      );
      const parsed = JSON.parse(aiContent);
      menuItems = parsed.items || [];
      console.info(`✅ [SCRAPE MENU ${requestId}] JSON parsed successfully`);
      console.info(`📊 [SCRAPE MENU ${requestId}] Parsed items count: ${menuItems.length}`);

      if (menuItems.length === 0) {
        console.warn(`⚠️ [SCRAPE MENU ${requestId}] GPT-4 returned ZERO items!`);
        console.warn(`Full AI response:`, aiContent);
        console.warn(`Text sent to AI (first 1000 chars):`, truncatedText.substring(0, 1000));
      } else {
        console.info(`\n${"=".repeat(80)}`);
        console.info(`📋 EXTRACTED MENU ITEMS - DETAILED BREAKDOWN:`);
        console.info(`${"=".repeat(80)}`);

        // Log first 10 items in detail
        const itemsToShow = Math.min(10, menuItems.length);
        for (let i = 0; i < itemsToShow; i++) {
          const item = menuItems[i];
          console.info(`\n[Item ${i + 1}/${menuItems.length}]`);
          console.info(`  📛 Name: "${item.name || "N/A"}"`);
          console.info(`  💰 Price: £${item.price || "N/A"}`);
          console.info(
            `  📝 Description: ${item.description ? `"${item.description.substring(0, 80)}${item.description.length > 80 ? "..." : ""}"` : "N/A"}`
          );
          console.info(`  🏷️  Category: "${item.category || "N/A"}"`);
          console.info(
            `  🖼️  Image: ${item.image ? "YES" : "NO"}${item.image ? ` - ${item.image.substring(0, 50)}...` : ""}`
          );
        }

        if (menuItems.length > 10) {
          console.info(`\n... and ${menuItems.length - 10} more items (not shown)`);
        }

        console.info(`\n${"=".repeat(80)}`);
        console.info(`📊 EXTRACTION STATISTICS:`);
        console.info(`${"=".repeat(80)}`);
        console.info(`  📋 Total items extracted: ${menuItems.length}`);
        console.info(`  💰 Items with prices: ${menuItems.filter((i) => i.price > 0).length}`);
        console.info(
          `  📝 Items with descriptions: ${menuItems.filter((i) => i.description && i.description.length > 10).length}`
        );
        console.info(`  🖼️  Items with images: ${menuItems.filter((i) => i.image).length}`);
        console.info(`  🏷️  Unique categories: ${new Set(menuItems.map((i) => i.category)).size}`);
        console.info(
          `  📏 Avg description length: ${Math.round(menuItems.reduce((sum, i) => sum + (i.description?.length || 0), 0) / menuItems.length)} chars`
        );

        const categories = Array.from(new Set(menuItems.map((i) => i.category)));
        console.info(`  📚 Categories found: ${categories.join(", ")}`);
        console.info(`${"=".repeat(80)}\n`);
      }
    } catch (parseError) {
      console.error(`❌ [SCRAPE MENU ${requestId}] Failed to parse AI response:`, parseError);
      console.error(`AI response full:`, aiContent);
      throw new Error("AI returned invalid JSON");
    }

    const totalDuration = Date.now() - startTime;
    console.info(`✅ [SCRAPE MENU ${requestId}] Extracted ${menuItems.length} items`);
    console.info(
      `⏱️  [SCRAPE MENU ${requestId}] Total time: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`
    );
    logger.info("[MENU SCRAPE] Extraction complete", {
      itemCount: menuItems.length,
      duration: totalDuration,
    });

    const successResponse = {
      ok: true,
      items: menuItems,
      message: `Found ${menuItems.length} items from menu`,
    };

    console.info(
      `📤 [SCRAPE MENU ${requestId}] Sending success response with ${menuItems.length} items`
    );
    console.info(`${"=".repeat(80)}`);
    console.info(
      `✅ [SCRAPE MENU ${requestId}] REQUEST COMPLETE - ${(totalDuration / 1000).toFixed(1)}s total`
    );
    console.info(`${"=".repeat(80)}\n`);

    return NextResponse.json(successResponse);
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`\n${"=".repeat(80)}`);
    console.error(
      `❌ [SCRAPE MENU ${requestId}] REQUEST FAILED after ${(totalDuration / 1000).toFixed(1)}s`
    );
    console.error(`${"=".repeat(80)}`);
    console.error(
      `❌ [SCRAPE MENU ${requestId}] Error type:`,
      error?.constructor?.name || "Unknown"
    );
    console.error(
      `❌ [SCRAPE MENU ${requestId}] Error message:`,
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      `❌ [SCRAPE MENU ${requestId}] Error stack:`,
      error instanceof Error ? error.stack : "No stack trace"
    );
    console.error(`${"=".repeat(80)}\n`);

    logger.error("[MENU SCRAPE] Error:", error);

    const errorResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to scrape menu",
    };

    console.info(`📤 [SCRAPE MENU ${requestId}] Sending error response:`, errorResponse);

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
