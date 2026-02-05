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

/** Document coordinates for layout-aware matching. */
export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface WebMenuItem {
  name: string;
  name_normalized: string;
  description?: string;
  price?: number;
  image_url?: string;
  category?: string;
  source: "dom" | "vision" | "merged";
  /** Layout rect for spatial image matching (optional). */
  rect?: Rect;
  /** Per-field confidence 0-1 for user feedback (optional). */
  _confidence?: { name?: number; description?: number; price?: number; category?: number; image_url?: number };
}

interface PageImage {
  url: string;
  altText?: string;
  width?: number;
  height?: number;
  /** Document rect for spatial proximity matching. */
  rect?: Rect;
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
  console.info("[menu-upload] [WEB-EXTRACT] Starting website extraction for:", url);
  const executablePath = await getChromiumPath();
  console.info("[menu-upload] [WEB-EXTRACT] Chromium path:", executablePath ? "found" : "not found");

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
    console.info("[menu-upload] [WEB-EXTRACT] Page loaded");

    await Promise.race([
      page
        .waitForSelector('[class*="menu"], [class*="item"], [class*="dish"], article', {
          timeout: 5000,
        })
        .catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.info("[menu-upload] [WEB-EXTRACT] Wait complete, extracting images and DOM...");

    // Extract ALL images from the page first (before DOM items)
    const allPageImages = await extractAllPageImages(page);
    const imageCount = allPageImages.length;
    console.info("[menu-upload] [URL-IMAGES] Page image count:", imageCount);
    if (imageCount > 0) {
      console.info(
        "[menu-upload] [URL-IMAGES] Sample (first 5):",
        JSON.stringify(
          allPageImages.slice(0, 5).map((img) => ({
            url: img.url?.substring(0, 100),
            alt: img.altText ?? null,
            w: img.width,
            h: img.height,
          }))
        )
      );
    } else {
      console.info("[menu-upload] [URL-IMAGES] No images found on page (querySelectorAll img)");
    }

    // Extract items from DOM
    const domItems = await extractFromDOM(page);
    console.info("[menu-upload] [WEB-EXTRACT] DOM items:", domItems.length);

    // Associate images with DOM items
    const domItemsWithImages = associateImagesWithItemsMultiSignal(domItems, allPageImages);
    const domWithImages = domItemsWithImages.filter((i) => i.image_url).length;
    console.info("[menu-upload] [URL-IMAGES] After association: DOM items with image_url:", domWithImages, "of", domItemsWithImages.length);

    // Screenshot + Vision AI
    const screenshot = (await page.screenshot({
      fullPage: true,
      type: "png",
      encoding: "base64",
    })) as string;
    console.info("[menu-upload] [WEB-EXTRACT] Screenshot length:", screenshot.length);

    const screenshotDataUrl = `data:image/png;base64,${screenshot}`;
    const visionResult = await extractMenuFromImage(screenshotDataUrl);
    const visionItems = visionResult.items;
    console.info("[menu-upload] [WEB-EXTRACT] Vision items:", visionItems.length);

    const mergedItems = mergeExtractedData(domItemsWithImages, visionItems, allPageImages);
    const mergedWithImages = mergedItems.filter((i) => i.image_url).length;
    console.info("[menu-upload] [URL-IMAGES] After merge: items with image_url:", mergedWithImages, "of", mergedItems.length);
    if (mergedWithImages > 0) {
      console.info(
        "[menu-upload] [URL-IMAGES] Sample merged with image:",
        JSON.stringify(
          mergedItems
            .filter((i) => i.image_url)
            .slice(0, 3)
            .map((i) => ({ name: i.name, imageUrl: i.image_url?.substring(0, 80) }))
        )
      );
    } else {
      console.info("[menu-upload] [URL-IMAGES] WARNING: Zero items with image_url after merge");
    }
    console.info("[menu-upload] url extraction done", { url, itemCount: mergedItems.length, withImageUrl: mergedWithImages });

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
  console.info("[menu-upload] [URL-IMAGES] Extracting img elements from page (browser)...");
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

      const rect = imgEl.getBoundingClientRect();
      const imageEntry = {
        url: absoluteSrc,
        altText: imgEl.alt || undefined,
        width,
        height,
        rect: {
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        },
      };
      console.log("[IMAGES] Added image:", imageEntry);
      images.push(imageEntry);
    });

    return images;
  });

  console.info("[menu-upload] [URL-IMAGES] Browser returned", result.length, "images after filters (no src/placeholder/tiny skipped)");
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

/** Distance between two rects (center to center) for spatial scoring. */
function rectDistance(a: Rect, b: Rect): number {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Multi-signal image association: alt text, URL path, name substring, and spatial proximity.
 */
function associateImagesWithItemsMultiSignal(
  domItems: WebMenuItem[],
  allImages: PageImage[]
): WebMenuItem[] {
  console.info("[menu-upload] [ASSOCIATE] Multi-signal:", domItems.length, "items,", allImages.length, "images");
  return domItems.map((item) => {
    if (item.image_url) return item;
    let bestImage: PageImage | null = null;
    let bestScore = 0;
    for (const img of allImages) {
      const altText = img.altText?.toLowerCase() || "";
      const urlParts = img.url.toLowerCase().split("/").pop() || "";
      const itemName = item.name_normalized;
      let score = 0;
      if (altText && itemName) {
        if (altText.includes(itemName) || itemName.includes(altText)) score += 0.5;
        else if (itemName.split(" ").filter((w) => w.length > 2).some((w) => altText.includes(w))) score += 0.25;
      }
      if (itemName.split(" ").filter((w) => w.length > 2).some((w) => urlParts.includes(w))) score += 0.3;
      if (item.rect && img.rect) {
        const dist = rectDistance(item.rect, img.rect);
        score += Math.max(0, 0.4 * (1 - dist / 800));
      }
      if (score > bestScore) {
        bestScore = score;
        bestImage = img;
      }
    }
    if (bestImage && bestScore >= 0.2) {
      return {
        ...item,
        image_url: bestImage.url,
        _confidence: { ...item._confidence, image_url: Math.min(1, bestScore + 0.3) },
      };
    }
    return item;
  });
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
      rect?: { top: number; left: number; width: number; height: number };
    }
    const items: DOMMenuItem[] = [];
    const seenNormalized = new Set<string>();

    function findSectionHeader(el: Element | null): string | undefined {
      let current: Element | null = el;
      for (let depth = 0; depth < 15 && current; depth++) {
        let prev: Element | null = current.previousElementSibling;
        for (let i = 0; i < 10 && prev; i++) {
          const tag = prev.tagName?.toUpperCase() || "";
          if (/^H[1-6]$/.test(tag)) {
            const t = prev.textContent?.trim();
            if (t && t.length < 80) return t;
          }
          const cls = (prev.getAttribute?.("class") || "").toLowerCase();
          if (/section|category|heading|menu-section|menu-category|group-title/.test(cls)) {
            const t = prev.textContent?.trim();
            if (t && t.length < 80) return t;
          }
          prev = prev.previousElementSibling;
        }
        current = current.parentElement;
      }
      return undefined;
    }

    // DOM structure learning: auto-discover site-specific selectors by picking the selector
    // that yields the most elements with both name and price (best for this site's markup).
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

    function hasNameAndPrice(el: Element): boolean {
      const nameSelectors = ["[data-name]", '[itemprop="name"]', '[class*="name"]', '[class*="title"]', "h1", "h2", "h3", "h4", "strong", ".product-title", ".item-name"];
      let hasName = false;
      for (const s of nameSelectors) {
        const n = el.querySelector(s);
        if (n?.textContent?.trim() && n.textContent.trim().length >= 2) {
          hasName = true;
          break;
        }
      }
      if (!hasName) return false;
      const text = el.textContent || "";
      return /[£$€]?\s*\d+[.,]\d{2}|\d+[.,]\d{2}\s*[£$€]/.test(text);
    }

    let elements: Element[] = [];
    let bestValidCount = 0;
    for (const selector of possibleSelectors) {
      const found = Array.from(document.querySelectorAll(selector));
      if (found.length <= 3) continue;
      const validCount = found.filter(hasNameAndPrice).length;
      if (validCount > bestValidCount) {
        bestValidCount = validCount;
        elements = found;
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
          const nameNorm = name.toLowerCase().trim();
          if (seenNormalized.has(nameNorm)) return;
          seenNormalized.add(nameNorm);
          const rect = el.getBoundingClientRect();
          const category = findSectionHeader(el);
          items.push({
            name,
            name_normalized: nameNorm,
            description: description || undefined,
            price,
            image_url: imageUrl || undefined,
            category: category || undefined,
            source: "dom",
            index,
            rect: {
              top: rect.top + window.scrollY,
              left: rect.left + window.scrollX,
              width: rect.width,
              height: rect.height,
            },
          });
        }
      } catch {
        // Skip on error
      }
    });

    if (items.length < 5) {
      const allEls = document.querySelectorAll("div, li, article, section");
      allEls.forEach((el) => {
        const text = (el.textContent || "").trim();
        if (text.length < 15 || text.length > 600) return;
        const priceMatch = text.match(/[£$€]?\s*(\d+[.,]\d{2})/);
        if (!priceMatch || priceMatch[1] == null) return;
        const priceNum = parseFloat(priceMatch[1].replace(",", "."));
        const beforePrice = text.substring(0, text.indexOf(priceMatch[0])).trim();
        const lines = beforePrice.split(/\n/).map((s) => s.trim()).filter(Boolean);
        const name = lines.length > 0 ? lines[lines.length - 1] : beforePrice.split(/\s{2,}/)[0] || beforePrice.slice(0, 80);
        if (!name || name.length < 2 || name.length > 150) return;
        const nameNorm = name.toLowerCase().trim();
        if (seenNormalized.has(nameNorm)) return;
        seenNormalized.add(nameNorm);
        const rect = el.getBoundingClientRect();
        items.push({
          name,
          name_normalized: nameNorm,
          price: priceNum,
          category: findSectionHeader(el),
          source: "dom",
          index: items.length,
          rect: {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
          },
        });
      });
    }

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
  console.info("[menu-upload] [MERGE] Starting merge: DOM", domItems.length, "Vision", visionItems.length, "page images", allPageImages.length);

  const imageMap = new Map<string, PageImage>();
  allPageImages.forEach((img) => {
    const altText = img.altText?.toLowerCase() || "";
    const urlParts = img.url.toLowerCase();
    imageMap.set(altText, img);
    imageMap.set(urlParts, img);
  });
  console.info("[menu-upload] [MERGE] imageMap entries:", imageMap.size);

  const merged: WebMenuItem[] = visionItems.map((visionItem, idx) => {
    const domMatch = domItems.find((domItem) => {
      const similarity = calculateSimilarity(
        visionItem.name.toLowerCase().trim(),
        domItem.name_normalized
      );
      return similarity >= 0.7;
    });

    let image_url = domMatch?.image_url;
    let imageSource = image_url ? "dom" : null;

    if (!image_url) {
      const itemName = visionItem.name.toLowerCase();
      const itemWords = itemName.split(/\s+/).filter((w) => w.length > 2);
      for (const [key, img] of imageMap) {
        const filename = key.split("/").pop() || "";
        if (key.includes(itemName) || itemName.includes(filename)) {
          image_url = img.url;
          imageSource = "imageMap_key";
          break;
        }
        if (itemWords.some((w) => key.includes(w) || filename.replace(/\.[a-z]+$/i, "").includes(w))) {
          image_url = img.url;
          imageSource = "imageMap_words";
          break;
        }
      }
    }

    if (idx < 5 || (idx < 15 && !image_url)) {
      console.info("[menu-upload] [MERGE] item", idx + 1, visionItem.name, "image:", image_url ? "yes" : "none", "source:", imageSource ?? "none");
    }

    const visionConf = { name: 0.95, description: 0.9, price: 0.95, category: 0.9, image_url: image_url ? 0.85 : 0.5 };
    const domConf = domMatch
      ? { name: 0.75, description: 0.7, price: 0.75, category: domMatch.category ? 0.8 : 0.5, image_url: domMatch.image_url ? 0.8 : 0.5 }
      : null;
    const confidence = domConf
      ? {
          name: Math.max(visionConf.name, domConf.name),
          description: Math.max(visionConf.description, domConf.description),
          price: Math.max(visionConf.price, domConf.price),
          category: Math.max(visionConf.category, domConf.category),
          image_url: Math.max(visionConf.image_url, domConf.image_url),
        }
      : visionConf;

    return {
      name: visionItem.name,
      name_normalized: visionItem.name.toLowerCase().trim(),
      description: domMatch?.description || visionItem.description,
      price: visionItem.price || domMatch?.price,
      image_url,
      category: visionItem.category || domMatch?.category,
      source: domMatch ? ("merged" as const) : ("vision" as const),
      _confidence: confidence,
    };
  });

  console.info("[menu-upload] [MERGE] After vision: items with image_url:", merged.filter((i) => i.image_url).length);

  let addedCount = 0;
  domItems.forEach((domItem) => {
    const exists = merged.some(
      (m) => calculateSimilarity(m.name_normalized, domItem.name_normalized) >= 0.7
    );

    if (!exists && domItem.name && (domItem.price || domItem.image_url)) {
      if (addedCount < 5) {
        console.info("[menu-upload] [MERGE] DOM-only item:", domItem.name, "image_url:", domItem.image_url ? "yes" : "no");
      }
      merged.push({
        name: domItem.name,
        name_normalized: domItem.name_normalized,
        description: domItem.description,
        price: domItem.price,
        image_url: domItem.image_url,
        category: domItem.category,
        source: "dom" as const,
        _confidence: domItem._confidence ?? {
          name: 0.75,
          description: 0.6,
          price: 0.75,
          category: domItem.category ? 0.8 : 0.5,
          image_url: domItem.image_url ? 0.8 : 0.5,
        },
      });
      addedCount++;
    }
  });

  console.info("[menu-upload] [MERGE] DOM-only added:", addedCount, "Final:", merged.length, "items,", merged.filter((i) => i.image_url).length, "with images");
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

