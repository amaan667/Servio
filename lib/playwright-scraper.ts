/**
 * Self-Hosted Playwright Scraper
 * Runs directly on Railway - NO external API needed
 * Much faster and free compared to Browserless
 */

type BrowserInstance = {
  newContext: (options: unknown) => Promise<unknown>;
  close: () => Promise<void>;
};

let browser: BrowserInstance | null = null;

// Initialize browser once and reuse (much faster)
async function getBrowser(): Promise<BrowserInstance> {
  if (!browser) {
    // Dynamic import to avoid Next.js bundling issues
    const { chromium } = await import("playwright-core");

    // Use system Chromium on Railway, or Playwright's downloaded browser locally
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

    console.info(
      `🌐 Launching browser${executablePath ? ` from ${executablePath}` : " (auto-detect)"}`
    );

    browser = (await chromium.launch({
      headless: true,
      executablePath, // Use system Chromium on Railway
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
      ],
    })) as BrowserInstance;

    console.info("✅ Browser launched successfully");
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
 * Optimized for JS-heavy sites like Cafe Nur
 */
export async function scrapeWithPlaywright(
  url: string,
  timeout: number = 30000,
  waitForNetworkIdle: boolean = false
): Promise<ScrapedContent> {
  const browser = await getBrowser();
  const context = (await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  })) as { newPage: () => Promise<unknown>; close: () => Promise<void> };

  const page = (await context.newPage()) as {
    goto: (url: string, options: unknown) => Promise<void>;
    waitForTimeout: (ms: number) => Promise<void>;
    waitForSelector: (selector: string, options: unknown) => Promise<unknown>;
    content: () => Promise<string>;
    evaluate: (fn: (...args: unknown[]) => unknown, ...args: unknown[]) => Promise<unknown>;
    close: () => Promise<void>;
  };

  try {
    // Navigate with appropriate wait condition
    await page.goto(url, {
      waitUntil: waitForNetworkIdle ? "networkidle" : "domcontentloaded",
      timeout,
    });

    // Wait longer for JS-heavy sites (like Cafe Nur)
    await page.waitForTimeout(waitForNetworkIdle ? 2000 : 1000);

    // Try to wait for common menu selectors (helps with JS sites)
    await page
      .waitForSelector(
        'main, [class*="menu"], [class*="item"], [role="main"], #menu, .menu-container',
        { timeout: 5000 }
      )
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

/**
 * Smart scraping with automatic retry for JS-heavy sites
 * Perfect for sites like Cafe Nur that heavily rely on JavaScript
 */
export async function smartScrape(url: string): Promise<ScrapedContent> {
  try {
    // Try fast approach first (works for 80% of sites)
    const result = await scrapeWithPlaywright(url, 20000, false);

    // Validate we got meaningful content
    if (result.text.length > 500) {
      console.info("✅ Fast scrape successful");
      return result;
    }

    console.info("⚠️ Insufficient content, trying with networkidle...");
  } catch {
    console.info("⚠️ Fast scrape failed, trying with networkidle...");
  }

  // Fallback: Use networkidle for JS-heavy sites like Cafe Nur
  return await scrapeWithPlaywright(url, 30000, true);
}

// Cleanup on shutdown
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
