import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import * as cheerio from "cheerio";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface BrowserlessConfig {
  url: string;
  timeout: number;
  waitUntil: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
}

interface ScrapedContent {
  html: string;
  text: string;
  images: string[];
}

/**
 * Scrape with Browserless using optimized configuration
 * Uses progressive timeout strategy for reliable content extraction
 */
async function scrapeWithBrowserless(
  url: string,
  config: BrowserlessConfig,
  requestId: string
): Promise<ScrapedContent> {
  const browserlessUrl = `https://production-sfo.browserless.io/scrape?token=${process.env.BROWSERLESS_API_KEY}`;

  console.info(
    `📡 [SCRAPE ${requestId}] Browserless: timeout=${config.timeout}ms, waitUntil=${config.waitUntil}`
  );

  const controller = new AbortController();
  // Add buffer for API overhead and network latency
  const timeoutId = setTimeout(() => controller.abort(), config.timeout + 10000);

  try {
    const response = await fetch(browserlessUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        url: url,
        elements: [
          {
            selector: "body",
          },
        ],
        gotoOptions: {
          waitUntil: config.waitUntil,
          timeout: config.timeout,
        },
        // Wait for dynamic content to load after page events
        waitForTimeout: 1000, // 1 second for JS to settle (most sites load within 1s)
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ [SCRAPE ${requestId}] Browserless HTTP error: ${response.status} - ${errorText}`
      );
      throw new Error(`Browserless HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const scrapedElement = data.data?.[0];

    if (!scrapedElement || !scrapedElement.results?.[0]?.html) {
      console.error(
        `❌ [SCRAPE ${requestId}] No HTML in response:`,
        JSON.stringify(data).substring(0, 500)
      );
      throw new Error("Browserless returned no HTML content");
    }

    const html = scrapedElement.results[0].html;
    console.info(`📄 [SCRAPE ${requestId}] Received HTML: ${html.length} chars`);

    // Parse with Cheerio for content extraction
    const $ = cheerio.load(html);

    // Remove non-content elements but keep main content
    $("script, style, noscript, svg, iframe").remove();
    // Keep nav/header/footer for now as some menus might be there

    // Extract text from body
    let text = $("body").text();

    // Clean up whitespace while preserving structure
    text = text
      .replace(/\r?\n/g, " ") // Replace newlines with spaces
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .trim();

    console.info(`📝 [SCRAPE ${requestId}] Extracted text: ${text.length} chars`);

    // Extract all images with multiple fallback attributes
    const images: string[] = [];
    const imageSet = new Set<string>(); // Deduplicate images

    $("img, picture source").each((_, elem) => {
      const attrs = [
        "src",
        "data-src",
        "data-lazy-src",
        "data-original",
        "data-srcset",
        "srcset",
        "data-fallback-src",
      ];

      for (const attr of attrs) {
        let src = $(elem).attr(attr);
        if (src) {
          // Handle srcset (take first URL)
          if (attr.includes("srcset")) {
            src = src.split(",")[0].trim().split(" ")[0];
          }

          // Convert relative to absolute URLs
          if (!src.startsWith("http") && !src.startsWith("data:")) {
            try {
              src = new URL(src, url).href;
            } catch {
              continue; // Invalid URL, skip
            }
          }

          // Only add valid HTTP(S) images
          if (src && src.startsWith("http") && !imageSet.has(src)) {
            imageSet.add(src);
            images.push(src);
          }
        }
      }
    });

    console.info(`📷 [SCRAPE ${requestId}] Extracted images: ${images.length} unique URLs`);
    console.info(
      `✅ [SCRAPE ${requestId}] Extraction complete: ${html.length} chars HTML, ${text.length} chars text, ${images.length} images`
    );

    return { html, text, images };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(
          `Request timeout after ${config.timeout}ms with waitUntil='${config.waitUntil}'`
        );
      }
      console.error(`❌ [SCRAPE ${requestId}] Error in scrapeWithBrowserless:`, error.message);
    }

    throw error;
  }
}

/**
 * Optimized retry strategy - Fast by default, patient when needed
 * Most sites will complete in under 30 seconds
 *
 * Strategy progression:
 * 1. Fast: 20s with domcontentloaded (catches 80% of sites)
 * 2. Standard: 60s with load (handles slower sites)
 * 3. Patient: 120s with networkidle2 (only for problematic sites)
 */
async function scrapeWithRetry(url: string, requestId: string): Promise<ScrapedContent> {
  const strategies: BrowserlessConfig[] = [
    { url, timeout: 20000, waitUntil: "domcontentloaded" }, // Fast - 20s
    { url, timeout: 60000, waitUntil: "load" }, // Standard - 60s
    { url, timeout: 120000, waitUntil: "networkidle2" }, // Patient - 120s (only if needed)
  ];

  const errors: string[] = [];

  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    const attempt = i + 1;

    console.info(
      `🔄 [SCRAPE ${requestId}] Attempt ${attempt}/${strategies.length} (timeout: ${strategy.timeout / 1000}s, waitUntil: ${strategy.waitUntil})`
    );

    try {
      const result = await scrapeWithBrowserless(url, strategy, requestId);

      // Validate result has meaningful content
      if (result.text.length < 50) {
        throw new Error(`Insufficient content: only ${result.text.length} characters extracted`);
      }

      console.info(
        `✅ [SCRAPE ${requestId}] Successfully scraped on attempt ${attempt} - ${result.text.length} chars, ${result.images.length} images`
      );
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Attempt ${attempt} (${strategy.timeout / 1000}s): ${errorMsg}`);

      console.warn(`⚠️ [SCRAPE ${requestId}] Attempt ${attempt} failed: ${errorMsg}`);

      // Check if this is a retryable error
      const isRetryable =
        errorMsg.includes("timeout") ||
        errorMsg.includes("Insufficient") ||
        errorMsg.includes("Navigation") ||
        errorMsg.includes("net::") ||
        errorMsg.includes("ERR_") ||
        errorMsg.includes("waiting for");

      // If not retryable, fail immediately
      if (!isRetryable) {
        console.error(`❌ [SCRAPE ${requestId}] Fatal error (not retryable): ${errorMsg}`);
        throw new Error(
          `Unable to scrape URL: ${errorMsg}\n\n` +
            `This error is not related to timeout. Possible causes:\n` +
            `- Invalid or inaccessible URL\n` +
            `- Page requires authentication\n` +
            `- Anti-bot protection blocking access\n` +
            `- Website is down or blocking automated access`
        );
      }

      // If not the last attempt, continue to next strategy
      if (i < strategies.length - 1) {
        const delaySeconds = 1; // Reduced delay for faster retries
        console.info(
          `🔄 [SCRAPE ${requestId}] Waiting ${delaySeconds}s before trying next strategy...`
        );
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }
  }

  // All attempts exhausted
  throw new Error(
    `Unable to scrape URL after ${strategies.length} attempts with timeouts up to ${strategies[strategies.length - 1].timeout / 1000} seconds.\n\n` +
      `Attempt details:\n${errors.join("\n")}\n\n` +
      `Possible causes:\n` +
      `- Site takes very long to load (>2 minutes)\n` +
      `- Site uses advanced anti-bot protection\n` +
      `- Page requires login or specific cookies\n` +
      `- Site is experiencing technical difficulties\n` +
      `- Geo-blocking or access restrictions\n\n` +
      `Recommendations:\n` +
      `- Verify the URL is accessible in a regular browser\n` +
      `- Check if the site requires authentication\n` +
      `- Try again later or during off-peak hours\n` +
      `- Contact support if the issue persists`
  );
}

/**
 * Scrape Menu from URL with Advanced Rendering & Timeout Handling
 * Uses Browserless for ALL URLs to ensure perfect JavaScript rendering
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

    // Check for Browserless API key
    if (!process.env.BROWSERLESS_API_KEY) {
      console.error(`❌ [SCRAPE MENU ${requestId}] BROWSERLESS_API_KEY not configured`);
      return NextResponse.json(
        {
          ok: false,
          error: `Menu scraping requires BROWSERLESS_API_KEY for reliable content extraction.
          
Setup Instructions:
1. Sign up at https://www.browserless.io/
2. Get your API key
3. Add to environment: BROWSERLESS_API_KEY=your_key_here
4. Restart the application

Alternative: Manually add menu items in Menu Management.`,
        },
        { status: 400 }
      );
    }

    // Use Browserless for ALL URLs - ensures perfect rendering
    console.info(
      `🚀 [SCRAPE MENU ${requestId}] Using Browserless.io with adaptive timeout strategy...`
    );

    const { images: imageUrls, text: finalText } = await scrapeWithRetry(url, requestId);

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

    // Step 4: Use GPT-4 to extract menu items (from rendered or static HTML)
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
