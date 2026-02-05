/**
 * Web Menu Extraction using Puppeteer + GPT-4o Vision
 *
 * Strategy: Avoid networkidle and scrolling issues by using:
 * - domcontentloaded (fast, reliable)
 * - Fixed timeouts with fallbacks
 * - Single fullPage screenshot (no manual scrolling)
 * - Hybrid DOM + Vision AI extraction
 * - Production-ready with @sparticuz/chromium for serverless
 *
 * DEBUG LOGGING: All extraction steps logged for Railway debugging
 */

import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { extractMenuFromImage } from "./gptVisionMenuParser";

interface WebMenuItem {
  name: string;
  name_normalized: string;
  description?: string;
  price?: number;
  image_url?: string;
  category?: string;
  source: "dom" | "vision" | "merged";
}

interface PageImage {
  url: string;
  altText?: string;
  width?: number;
  height?: number;
}

/**
 * Get Chromium executable path for production (Railway) or local development
 */
async function getChromiumPath() {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) {
    return await chromium.executablePath();
  } else {
    const possiblePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ];

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
  console.info("[menu-upload] url extraction start", { url });
  console.log("[WEB-EXTRACT] Starting website extraction for:", url);
  const executablePath = await getChromiumPath();
  console.log("[WEB-EXTRACT] Chromium executable path:", executablePath ? "found" : "not found");

  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--hide-scrollbars",
      "--disable-features=VizDisplayCompositor",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-component-extensions-with-background-pages",
      "--disable-features=TranslateUI,BlinkGenPropertyTrees",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--enable-features=NetworkService,NetworkServiceInProcess",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--no-first-run",
      "--disable-audio-output",
      "--no-zygote",
      "--single-process",
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
    executablePath,
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    console.log("[WEB-EXTRACT] Page loaded successfully");

    await Promise.race([
      page
        .waitForSelector('[class*="menu"], [class*="item"], [class*="dish"], article', {
          timeout: 5000,
        })
        .catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("[WEB-EXTRACT] Waiting complete, starting extraction...");

    // Extract ALL images from the page first (before DOM items)
    const allPageImages = await extractAllPageImages(page);
    console.log("[WEB-EXTRACT] Total images extracted from page:", allPageImages.length);
    if (allPageImages.length > 0) {
      console.log("[WEB-EXTRACT] First 5 image URLs:", allPageImages.slice(0, 5).map((img) => ({ url: img.url, alt: img.altText, width: img.width, height: img.height })));
    }

    // Extract items from DOM
    const domItems = await extractFromDOM(page);
    console.log("[WEB-EXTRACT] DOM items extracted:", domItems.length);

    // Associate images with DOM items
    const domItemsWithImages = associateImagesWithItems(domItems, allPageImages);
    console.log("[WEB-EXTRACT] DOM items with images:", domItemsWithImages.filter((i) => i.image_url).length);

    // Screenshot + Vision AI
    const screenshot = (await page.screenshot({
      fullPage: true,
      type: "png",
      encoding: "base64",
    })) as string;
    console.log("[WEB-EXTRACT] Screenshot captured, size:", screenshot.length, "chars");

    const screenshotDataUrl = `data:image/png;base64,${screenshot}`;
    console.log("[WEB-EXTRACT] Calling Vision AI for extraction...");
    const visionResult = await extractMenuFromImage(screenshotDataUrl);
    const visionItems = visionResult.items;
    console.log("[WEB-EXTRACT] Vision AI extracted items:", visionItems.length);

    // Merge all data sources
    console.log("[WEB-EXTRACT] Merging data sources...");
    const mergedItems = mergeExtractedData(domItemsWithImages, visionItems, allPageImages);
    console.log("[WEB-EXTRACT] Final merged items:", mergedItems.length);
    console.log("[WEB-EXTRACT] Items with images in final result:", mergedItems.filter((i) => i.image_url).length);
    console.info("[menu-upload] url extraction done", { url, itemCount: mergedItems.length });

    return mergedItems;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.info("[menu-upload] url extraction error", { url, error: message });
    throw new Error(
      `Failed to scrape menu from URL: ${message}. ` +
        `Check Railway logs for details. Common issues: site requires auth, blocks bots, or unusual structure.`
    );
  } finally {
    try {
      await browser.close();
    } catch {
      // Silent close
    }
  }
}

/**
 * Extract ALL images from the page, not just those within menu item elements
 * This is critical for extracting images that might be in separate containers
 */
async function extractAllPageImages(page: import("puppeteer-core").Page): Promise<PageImage[]> {
  console.log("[IMAGES] Extracting all images from page...");
  const result = await page.evaluate(() => {
    const images: PageImage[] = [];
    const imgElements = document.querySelectorAll("img");
    console.log(`[IMAGES] Found ${imgElements.length} total img elements on page`);

    imgElements.forEach((imgEl) => {
      const src =
        imgEl.getAttribute("src") ||
        imgEl.getAttribute("data-src") ||
        imgEl.getAttribute("data-lazy-src") ||
        imgEl.getAttribute("data-original") ||
        imgEl.getAttribute("data-srcset")?.split(",")[0]?.split(" ")[0] ||
        "";

      if (!src) {
        console.log("[IMAGES] Skipping image with no src");
        return;
      }

      console.log("[IMAGES] Processing image:", src.substring(0, 100));

      // Skip placeholder/icon images
      if (
        src.includes("placeholder") ||
        src.includes("icon") ||
        src.includes("logo") ||
        src.endsWith(".svg")
      ) {
        console.log("[IMAGES] Skipping placeholder/icon/logo image");
        return;
      }

      // Skip tiny images (likely icons)
      const width = imgEl.width || 0;
      const height = imgEl.height || 0;
      if (width < 50 || height < 50) {
        console.log(`[IMAGES] Skipping tiny image: ${width}x${height}`);
        return;
      }

      // Convert relative URLs to absolute
      let absoluteSrc = src;
      if (!src.startsWith("http") && !src.startsWith("data:")) {
        try {
          absoluteSrc = new URL(src, window.location.origin).href;
        } catch (e) {
          console.log("[IMAGES] Failed to convert relative URL:", src);
          return;
        }
      }

      const imageEntry = {
        url: absoluteSrc,
        altText: imgEl.alt || undefined,
        width,
        height,
      };
      console.log("[IMAGES] Added image:", imageEntry);
      images.push(imageEntry);
    });

    console.log(`[IMAGES] Final count: ${images.length} images after filtering`);
    return images;
  });

  console.log("[IMAGES] Returning", result.length, "images from page");
  return result;
}

/**
 * Associate extracted images with menu items based on proximity and alt text
 */
function associateImagesWithItems(
  domItems: WebMenuItem[],
  allImages: PageImage[]
): WebMenuItem[] {
  console.log("[ASSOCIATE] Starting image association:", domItems.length, "items,", allImages.length, "images");
  
  // Create a map of item names to their images
  const itemImageMap = new Map<string, PageImage[]>();

  // Try to match images to items based on alt text or filename
  allImages.forEach((image, imgIdx) => {
    const altText = image.altText?.toLowerCase() || "";
    const urlParts = image.url.toLowerCase().split("/").pop() || "";
    console.log(`[ASSOCIATE] Processing image ${imgIdx}: alt="${altText}", urlParts="${urlParts.substring(0, 50)}"`);

    // Check each item for potential match
    domItems.forEach((item) => {
      const itemName = item.name_normalized.toLowerCase();

      // Match by alt text containing item name
      if (altText.includes(itemName) || itemName.includes(altText)) {
        console.log(`[ASSOCIATE] Match found: item "${item.name}" with image alt`);
        const existing = itemImageMap.get(item.name) || [];
        existing.push(image);
        itemImageMap.set(item.name, existing);
        return;
      }

      // Match by URL filename containing item name words
      const itemWords = itemName.split(" ").filter((w) => w.length > 2);
      const urlHasItemWords = itemWords.some((word) => urlParts.includes(word));

      if (urlHasItemWords) {
        console.log(`[ASSOCIATE] Match found: item "${item.name}" with URL (words: ${itemWords.join(", ")})`);
        const existing = itemImageMap.get(item.name) || [];
        existing.push(image);
        itemImageMap.set(item.name, existing);
      }
    });
  });

  // Update dom items with associated images (pick the best one)
  const result = domItems.map((item) => {
    const images = itemImageMap.get(item.name);
    if (images && images.length > 0 && images[0] && !item.image_url) {
      console.log(`[ASSOCIATE] Assigning image to item "${item.name}": ${images[0].url.substring(0, 50)}...`);
      return {
        ...item,
        image_url: images[0].url,
      };
    }
    return item;
  });

  console.log(`[ASSOCIATE] Final: ${result.filter((i) => i.image_url).length} items have images assigned`);
  return result;
}

/**
 * Extract menu items from DOM structure
 */
async function extractFromDOM(page: import("puppeteer-core").Page): Promise<WebMenuItem[]> {
  return await page.evaluate(() => {
    interface DOMMenuItem {
      name: string;
      name_normalized: string;
      description?: string;
      price?: number;
      image_url?: string;
      category?: string;
      source: string;
      index: number;
    }
    const items: DOMMenuItem[] = [];

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

    for (const selector of possibleSelectors) {
      const found = Array.from(document.querySelectorAll(selector));
      if (found.length > 3) {
        elements = found;
        break;
      }
    }

    if (elements.length === 0) {
      const allElements = document.querySelectorAll("div, li, article, section");
      elements = Array.from(allElements).filter((el) => {
        const text = el.textContent || "";
        return text.length > 10 && text.length < 500 && /[£$€]?\d+[.,]\d{2}/.test(text);
      });
    }

    elements.forEach((el, index) => {
      try {
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
        if (!name || name.length < 2 || name.length > 200) return;

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
        if (!priceText) {
          const elementText = el.textContent || "";
          const pricePattern =
            /[£$€]\s*(\d+[.,]\d{2})|(\d+[.,]\d{2})\s*[£$€]|(\d+[.,]\d{2})\s*(?:GBP|USD|EUR)/gi;
          const match = pricePattern.exec(elementText);
          if (match) priceText = match[0];
        }

        let price: number | undefined;
        if (priceText) {
          const cleanPrice = priceText.replace(/[£$€GBP USD EUR]/gi, "").trim();
          const priceMatch = cleanPrice.match(/\d+[.,]?\d*/);
          if (priceMatch) {
            price = parseFloat(priceMatch[0].replace(",", "."));
          }
        }

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
          if (descEl && descEl.textContent && descEl.textContent.trim().length > 5 && descEl.textContent !== name) {
            break;
          }
        }

        const description = descEl?.textContent?.trim();

        const imgEl = el.querySelector("img");
        let imageUrl: string | undefined;

        if (imgEl) {
          imageUrl =
            imgEl.getAttribute("src") ||
            imgEl.getAttribute("data-src") ||
            imgEl.getAttribute("data-lazy-src") ||
            imgEl.getAttribute("data-original") ||
            imgEl.getAttribute("data-srcset")?.split(",")[0]?.split(" ")[0] ||
            undefined;

          if (imageUrl && !imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) {
            try {
              imageUrl = new URL(imageUrl, window.location.origin).href;
            } catch {
              imageUrl = undefined;
            }
          }

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

        if (name) {
          items.push({
            name,
            name_normalized: name.toLowerCase().trim(),
            description: description || undefined,
            price,
            image_url: imageUrl || undefined,
            category: undefined,
            source: "dom",
            index,
          });
        }
      } catch {
        // Skip on error
      }
    });

    return items as unknown as WebMenuItem[];
  });
}

/**
 * Merge DOM and Vision AI extracted data, incorporating all page images
 */
function mergeExtractedData(
  domItems: WebMenuItem[],
  visionItems: import("./gptVisionMenuParser").ExtractedMenuItem[],
  allPageImages: PageImage[]
): WebMenuItem[] {
  console.log("[MERGE] Starting merge:");
  console.log("[MERGE] - DOM items:", domItems.length);
  console.log("[MERGE] - Vision items:", visionItems.length);
  console.log("[MERGE] - All page images:", allPageImages.length);
  
  // Build image map from all page images for matching
  const imageMap = new Map<string, PageImage>();
  allPageImages.forEach((img) => {
    const altText = img.altText?.toLowerCase() || "";
    const urlParts = img.url.toLowerCase();
    imageMap.set(altText, img);
    imageMap.set(urlParts, img);
  });
  console.log("[MERGE] Built imageMap with", imageMap.size, "entries");

  // Start with Vision AI data
  const merged: WebMenuItem[] = visionItems.map((visionItem, idx) => {
    console.log(`[MERGE] Processing vision item ${idx + 1}/${visionItems.length}: "${visionItem.name}"`);
    
    const domMatch = domItems.find((domItem) => {
      const similarity = calculateSimilarity(
        visionItem.name.toLowerCase().trim(),
        domItem.name_normalized
      );
      return similarity >= 0.7;
    });
    console.log("[MERGE] - DOM match found:", domMatch ? "yes" : "no");

    let image_url = domMatch?.image_url;
    console.log("[MERGE] - Image from DOM match:", image_url || "none");

    // If no DOM match, try to find image from all page images
    if (!image_url) {
      const itemName = visionItem.name.toLowerCase();
      console.log(`[MERGE] - Searching allPageImages for: "${itemName}"`);
      for (const [key, img] of imageMap) {
        console.log(`[MERGE] - Checking image key: "${key.substring(0, 50)}..."`);
        if (key.includes(itemName) || itemName.includes(key.split("/").pop() || "")) {
          image_url = img.url;
          console.log(`[MERGE] - Found image match: ${img.url.substring(0, 50)}...`);
          break;
        }
      }
    }

    console.log("[MERGE] - Final image_url for '" + visionItem.name + "':", image_url ? image_url.substring(0, 50) + "..." : "none");

    return {
      name: visionItem.name,
      name_normalized: visionItem.name.toLowerCase().trim(),
      description: domMatch?.description || visionItem.description,
      price: visionItem.price || domMatch?.price,
      image_url,
      category: visionItem.category || domMatch?.category,
      source: domMatch ? "merged" as const : "vision" as const,
    };
  });

  console.log("[MERGE] After vision processing:", merged.filter((i) => i.image_url).length, "items have images");

  // Add DOM-only items
  let addedCount = 0;
  domItems.forEach((domItem) => {
    const exists = merged.some(
      (m) => calculateSimilarity(m.name_normalized, domItem.name_normalized) >= 0.7
    );

    if (!exists && domItem.name && (domItem.price || domItem.image_url)) {
      console.log(`[MERGE] Adding DOM-only item: "${domItem.name}", image_url: ${domItem.image_url || "none"}`);
      merged.push({
        name: domItem.name,
        name_normalized: domItem.name_normalized,
        description: domItem.description,
        price: domItem.price,
        image_url: domItem.image_url,
        category: domItem.category,
        source: "dom" as const,
      });
      addedCount++;
    }
  });

  console.log(`[MERGE] Added ${addedCount} DOM-only items`);
  console.log(`[MERGE] Final result: ${merged.length} items, ${merged.filter((i) => i.image_url).length} with images`);
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
  const rows = str2.length;
  const cols = str1.length;
  if (rows === 0) return cols;
  if (cols === 0) return rows;

  const matrix: Array<Array<number>> = [];
  for (let i = 0; i <= rows; i++) {
    const row: Array<number> = new Array<number>(cols + 1).fill(0);
    row[0] = i;
    matrix.push(row);
  }

  for (let j = 0; j <= cols; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }

  return matrix[rows]![cols]!;
}

