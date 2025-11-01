/**
 * Web Menu Extraction using Puppeteer + GPT-4o Vision
 *
 * Strategy: Avoid networkidle and scrolling issues by using:
 * - domcontentloaded (fast, reliable)
 * - Fixed timeouts with fallbacks
 * - Single fullPage screenshot (no manual scrolling)
 * - Hybrid DOM + Vision AI extraction
 * - Production-ready with @sparticuz/chromium for serverless
 */

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { extractMenuFromImage } from "./gptVisionMenuParser";
import { logger } from "./logger";

interface WebMenuItem {
  name: string;
  name_normalized: string;
  description?: string;
  price?: number;
  image_url?: string;
  category?: string;
  source: "dom" | "vision" | "merged";
}

/**
 * Get Chromium executable path for production (Railway) or local development
 */
async function getChromiumPath() {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    // Production: use @sparticuz/chromium for serverless
    return await chromium.executablePath();
  } else {
    // Local: use system Chrome/Chromium
    // Common paths for different systems
    const possiblePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // macOS
      "/usr/bin/google-chrome", // Linux
      "/usr/bin/chromium-browser", // Linux
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // Windows
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", // Windows
    ];

    // Return first existing path, or undefined to use bundled Chromium
    return possiblePaths.find((path) => {
      try {
        const fs = require("fs");
        return fs.existsSync(path);
      } catch {
        return false;
      }
    });
  }
}

/**
 * Extract menu from website URL
 * Uses Puppeteer + Vision AI hybrid approach
 */
export async function extractMenuFromWebsite(url: string): Promise<WebMenuItem[]> {
  logger.info("[WEB EXTRACT] Starting extraction", { url });

  const executablePath = await getChromiumPath();
  logger.info("[WEB EXTRACT] Chrome path:", { executablePath });

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security", // Allow loading images from any domain
      "--hide-scrollbars",
      "--disable-features=VizDisplayCompositor",
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate with simple, reliable wait strategy (NO networkidle!)
    logger.info("[WEB EXTRACT] Navigating to URL...");
    await page.goto(url, {
      waitUntil: "domcontentloaded", // Fast and reliable
      timeout: 20000,
    });

    // Wait for menu content to appear with fallback
    logger.info("[WEB EXTRACT] Waiting for content...");
    await Promise.race([
      // Try to find menu-related elements
      page
        .waitForSelector('[class*="menu"], [class*="item"], [class*="dish"], article', {
          timeout: 5000,
        })
        .catch(() => null),
      // Fallback: just wait 3 seconds
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]).catch(() => {
      logger.warn("[WEB EXTRACT] No specific menu selectors found, continuing anyway");
    });

    // Additional wait for dynamic content
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info("[WEB EXTRACT] Page loaded, extracting data...");

    // Strategy 1: DOM Scraping (fast, gets images/URLs)
    const domItems = await extractFromDOM(page);
    logger.info("[WEB EXTRACT] DOM extraction complete", { count: domItems.length });

    // Strategy 2: Screenshot + Vision AI (accurate, handles any layout)
    logger.info("[WEB EXTRACT] Taking screenshot for Vision AI...");
    const screenshot = (await page.screenshot({
      fullPage: true, // Captures entire page without manual scrolling
      type: "png",
      encoding: "base64",
    })) as string;

    const screenshotDataUrl = `data:image/png;base64,${screenshot}`;
    logger.info("[WEB EXTRACT] Screenshot captured, sending to Vision AI...");

    const visionItems = await extractMenuFromImage(screenshotDataUrl);
    logger.info("[WEB EXTRACT] Vision AI extraction complete", { count: visionItems.length });

    // Strategy 3: Intelligent merge
    const mergedItems = mergeExtractedData(domItems, visionItems);
    logger.info("[WEB EXTRACT] Merge complete", {
      total: mergedItems.length,
      withImages: mergedItems.filter((i) => i.image_url).length,
    });

    return mergedItems;
  } catch (error) {
    logger.error("[WEB EXTRACT] Extraction failed", { error });
    throw new Error(
      `Failed to extract menu from website: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  } finally {
    await browser.close();
  }
}

/**
 * Extract menu items from DOM structure
 * Enhanced to handle multiple website patterns and extract images properly
 */
async function extractFromDOM(page: any): Promise<WebMenuItem[]> {
  return await page.evaluate(() => {
    const items: any[] = [];

    // Try multiple selector strategies to find menu items
    const possibleSelectors = [
      "[data-menu-item]",
      '[class*="menu-item"]',
      '[class*="MenuItem"]',
      '[class*="menu_item"]',
      '[class*="product"]',
      '[class*="Product"]',
      '[class*="dish"]',
      '[class*="food-item"]',
      '[class*="item"]',
      "article",
      '[itemtype*="Product"]',
      '[itemtype*="MenuItem"]',
      'li[class*="item"]',
      'div[class*="card"]',
    ];

    let elements: Element[] = [];

    // Find the best selector that gives us menu items
    for (const selector of possibleSelectors) {
      const found = Array.from(document.querySelectorAll(selector));
      if (found.length > 3) {
        // Likely found menu items (lowered from 5 to catch smaller menus)
        elements = found;
        console.log(`[DOM] Found ${elements.length} items with selector: ${selector}`);
        break;
      }
    }

    if (elements.length === 0) {
      console.log("[DOM] No menu items found with standard selectors, trying fallback...");
      // Fallback: look for any element with both text and price pattern
      const allElements = document.querySelectorAll("div, li, article, section");
      elements = Array.from(allElements).filter((el) => {
        const text = el.textContent || "";
        // Has both name-like text and price pattern
        return text.length > 10 && text.length < 500 && /[£$€]?\d+[.,]\d{2}/.test(text);
      });
      console.log(`[DOM] Fallback found ${elements.length} potential items`);
    }

    elements.forEach((el, index) => {
      try {
        // Find name - try multiple approaches with more selectors
        const nameSelectors = [
          "[data-name]",
          '[itemprop="name"]',
          '[class*="name"]',
          '[class*="Name"]',
          '[class*="title"]',
          '[class*="Title"]',
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "strong",
          "b",
          'span[class*="name"]',
          ".product-title",
          ".item-name",
          ".dish-name",
        ];

        let nameEl: Element | null = null;
        for (const selector of nameSelectors) {
          nameEl = el.querySelector(selector);
          if (nameEl && nameEl.textContent && nameEl.textContent.trim().length > 1) {
            break;
          }
        }

        const name = nameEl?.textContent?.trim();

        if (!name || name.length < 2 || name.length > 200) return; // Skip invalid items

        // Find price - enhanced with multiple strategies
        const priceSelectors = [
          "[data-price]",
          '[itemprop="price"]',
          '[class*="price"]',
          '[class*="Price"]',
          "span.price",
          "div.price",
          "p.price",
          ".cost",
          '[class*="amount"]',
        ];

        let priceEl: Element | null = null;
        for (const selector of priceSelectors) {
          priceEl = el.querySelector(selector);
          if (priceEl && priceEl.textContent) break;
        }

        let priceText = priceEl?.textContent?.trim();

        // Fallback: search in element text for price patterns
        if (!priceText) {
          const elementText = el.textContent || "";
          const pricePattern =
            /[£$€]\s*(\d+[.,]\d{2})|(\d+[.,]\d{2})\s*[£$€]|(\d+[.,]\d{2})\s*(?:GBP|USD|EUR)/gi;
          const match = pricePattern.exec(elementText);
          if (match) {
            priceText = match[0];
          }
        }

        let price: number | undefined;
        if (priceText) {
          // Handle various price formats: £3.50, $3.50, 3.50, €3,50, 3,50€
          const cleanPrice = priceText.replace(/[£$€GBP USD EUR]/gi, "").trim();
          const priceMatch = cleanPrice.match(/\d+[.,]?\d*/);
          if (priceMatch) {
            const priceStr = priceMatch[0].replace(",", ".");
            price = parseFloat(priceStr);
          }
        }

        // Find description - enhanced
        const descSelectors = [
          "[data-description]",
          '[itemprop="description"]',
          '[class*="desc"]',
          '[class*="Description"]',
          "p",
          'span[class*="desc"]',
          ".item-description",
          ".product-description",
        ];

        let descEl: Element | null = null;
        for (const selector of descSelectors) {
          descEl = el.querySelector(selector);
          if (
            descEl &&
            descEl.textContent &&
            descEl.textContent.trim().length > 5 &&
            descEl.textContent !== name
          ) {
            break;
          }
        }

        const description = descEl?.textContent?.trim();

        // Find image - enhanced with multiple strategies
        const imgEl = el.querySelector("img");
        let imageUrl: string | undefined;

        if (imgEl) {
          // Try multiple image source attributes
          imageUrl =
            imgEl.getAttribute("src") ||
            imgEl.getAttribute("data-src") ||
            imgEl.getAttribute("data-lazy-src") ||
            imgEl.getAttribute("data-original") ||
            imgEl.getAttribute("data-srcset")?.split(",")[0]?.split(" ")[0] ||
            undefined;

          // Convert relative URLs to absolute
          if (imageUrl && !imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
            try {
              imageUrl = new URL(imageUrl, window.location.origin).href;
            } catch (e) {
              console.error("[DOM] Failed to convert image URL:", imageUrl);
              imageUrl = undefined;
            }
          }

          // Skip placeholder/icon images
          if (
            imageUrl &&
            (imageUrl.includes("placeholder") ||
              imageUrl.includes("icon") ||
              imageUrl.includes("logo") ||
              imageUrl.endsWith(".svg"))
          ) {
            imageUrl = undefined;
          }
        }

        // Find category (from parent sections)
        let category = "";
        let parentEl = el.parentElement;
        let depth = 0;

        while (parentEl && depth < 5) {
          const categoryEl = parentEl.querySelector('h2, h3, [data-category], [class*="category"]');
          if (categoryEl) {
            category = categoryEl.textContent?.trim() || "";
            if (category && category !== name) {
              break;
            }
          }
          parentEl = parentEl.parentElement;
          depth++;
        }

        // Only add items with at least a name
        if (name) {
          items.push({
            name: name,
            name_normalized: name.toLowerCase().trim(),
            description: description || undefined,
            price: price,
            image_url: imageUrl || undefined,
            category: category || undefined,
            source: "dom",
            index: index,
          });
        }
      } catch (err) {
        console.error("[DOM] Error extracting item:", err);
      }
    });

    console.log(`[DOM] Successfully extracted ${items.length} items`);
    return items;
  });
}

/**
 * Merge DOM and Vision AI extracted data
 * Strategy: Vision AI is more accurate for text, DOM is better for images/URLs
 */
function mergeExtractedData(domItems: any[], visionItems: any[]): WebMenuItem[] {
  logger.info("[MERGE] Starting merge", {
    domCount: domItems.length,
    visionCount: visionItems.length,
  });

  // Start with Vision AI data (more accurate text extraction)
  const merged: WebMenuItem[] = visionItems.map((visionItem) => {
    // Find matching DOM item by name similarity
    const domMatch = domItems.find((domItem) => {
      const similarity = calculateSimilarity(
        visionItem.name.toLowerCase().trim(),
        domItem.name_normalized
      );
      return similarity > 0.8; // 80% similarity threshold
    });

    if (domMatch) {
      logger.info("[MERGE] Matched item", {
        vision: visionItem.name,
        dom: domMatch.name,
      });

      return {
        name: visionItem.name, // Prefer Vision AI for text accuracy
        name_normalized: visionItem.name.toLowerCase().trim(),
        description: domMatch.description || visionItem.description,
        price: visionItem.price || domMatch.price, // Prefer Vision AI price
        image_url: domMatch.image_url, // DOM has actual image URLs
        category: visionItem.category || domMatch.category,
        source: "merged" as const,
      };
    }

    // No DOM match - use Vision AI data only
    return {
      name: visionItem.name,
      name_normalized: visionItem.name.toLowerCase().trim(),
      description: visionItem.description,
      price: visionItem.price,
      image_url: undefined,
      category: visionItem.category,
      source: "vision" as const,
    };
  });

  // Add DOM-only items that Vision AI missed
  domItems.forEach((domItem) => {
    const exists = merged.some(
      (m) => calculateSimilarity(m.name_normalized, domItem.name_normalized) > 0.8
    );

    if (!exists && domItem.name && domItem.price) {
      logger.info("[MERGE] Adding DOM-only item", { name: domItem.name });
      merged.push({
        name: domItem.name,
        name_normalized: domItem.name_normalized,
        description: domItem.description,
        price: domItem.price,
        image_url: domItem.image_url,
        category: domItem.category,
        source: "dom" as const,
      });
    }
  });

  logger.info("[MERGE] Merge complete", {
    totalItems: merged.length,
    withImages: merged.filter((i) => i.image_url).length,
    merged: merged.filter((i) => i.source === "merged").length,
    visionOnly: merged.filter((i) => i.source === "vision").length,
    domOnly: merged.filter((i) => i.source === "dom").length,
  });

  return merged;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
