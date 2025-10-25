/**
 * Self-Hosted Playwright Scraper
 * Runs directly on Railway - NO external API needed
 * Much faster and free compared to Browserless
 */

import { chromium, Browser } from "playwright-core";

let browser: Browser | null = null;

// Initialize browser once and reuse (much faster)
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browser;
}

export interface ScrapedContent {
  html: string;
  text: string;
  images: string[];
}

/**
 * Scrape URL with Playwright - FAST and FREE
 */
export async function scrapeWithPlaywright(
  url: string,
  timeout: number = 30000
): Promise<ScrapedContent> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  });

  const page = await context.newPage();

  try {
    // Navigate with timeout
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    // Wait 1s for JS to settle
    await page.waitForTimeout(1000);

    // Get HTML
    const html = await page.content();

    // Extract text (remove scripts/styles)
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
      return clone.innerText;
    });

    // Extract images
    const images = await page.evaluate((baseUrl) => {
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

// Cleanup on shutdown
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
