import * as cheerio from 'cheerio';
import { logger } from './logger';

export interface ScrapedMenuItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
}

export interface ScrapeResult {
  items: ScrapedMenuItem[];
  venueName: string;
  categories: string[];
}

/**
 * Scrape menu using Puppeteer for JavaScript-rendered sites
 */
async function scrapeWithPuppeteer(url: string): Promise<string | null> {
  try {
    logger.info('[SCRAPER] Attempting Puppeteer for:', { url });
    
    // Check if Puppeteer is available in this environment
    const puppeteer = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');

    logger.info('[SCRAPER] Launching browser...');
    const browser = await puppeteer.default.launch({
      args: [
        ...chromium.default.args,
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    logger.info('[SCRAPER] Navigating to URL...');
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Less strict, faster
      timeout: 15000 // Shorter timeout
    });
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    await browser.close();
    
    logger.info('[SCRAPER] Puppeteer success, HTML length:', html.length);
    return html;
  } catch (error) {
    logger.warn('[SCRAPER] Puppeteer failed:', error);
    logger.warn('[SCRAPER] This is expected in some environments - falling back to PDF-only extraction');
    return null;
  }
}

export async function scrapeMenuFromUrl(url: string): Promise<ScrapeResult> {
  let html: string;

  logger.info('[SCRAPER] Starting scrape for:', { url });

  // Try static HTML first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    html = await response.text();
    logger.info('[SCRAPER] Static fetch success, length:', html.length);

    // Check if JavaScript-rendered (minimal content)
    if (html.includes('Loading...') || html.length < 5000) {
      logger.info('[SCRAPER] Detected JS-rendered site, trying Puppeteer...');
      const puppeteerHtml = await scrapeWithPuppeteer(url);
      if (puppeteerHtml) {
        html = puppeteerHtml;
      } else {
        logger.warn('[SCRAPER] Puppeteer failed, using static HTML anyway');
      }
    }
  } catch (error) {
    logger.warn('[SCRAPER] Static fetch failed, trying Puppeteer...', error);
    const puppeteerHtml = await scrapeWithPuppeteer(url);
    if (!puppeteerHtml) {
      throw new Error('Failed to fetch menu from URL - both static and Puppeteer failed');
    }
    html = puppeteerHtml;
  }

  const $ = cheerio.load(html);
  const items: ScrapedMenuItem[] = [];
  const categories = new Set<string>();
  
  let venueName = $('title').text().replace(/menu|Menu|MENU|-|–/gi, '').trim() || 'Imported Menu';

  // Enhanced scraping patterns
  $('section, .menu-section, [class*="menu"], [class*="category"]').each((_, section) => {
    const $section = $(section);
    
    const categoryName = $section.find('h2, h3, h4').first().text().trim() || 'Menu Items';
    if (!categoryName || categoryName.length < 2) return;

    const itemElements = $section.find(
      '.menu-item, .item, .product, .dish, article, .card, ' +
      '[class*="menu-item"], [class*="product"]'
    );

    itemElements.each((_, itemEl) => {
      const $item = $(itemEl);

      const name = $item.find('h3, h4, h5, strong, b, [class*="title"]').first().text().trim();
      if (!name || name.length < 2) return;

      const priceText = $item.find('.price, [class*="price"]').first().text() || $item.text();
      const priceMatch = priceText.match(/[£$€]?\s*(\d+(?:[.,]\d{2})?)/);
      if (!priceMatch) return;
      
      const price = parseFloat(priceMatch[1].replace(',', '.'));
      if (price < 0.5 || price > 500) return;

      const description = $item.find('p, .description, [class*="desc"]').first().text().trim() || `Delicious ${name}`;

      let imageUrl: string | undefined;
      const img = $item.find('img').first();
      if (img.length) {
        const imgSrc = img.attr('src') || img.attr('data-src');
        if (imgSrc && !imgSrc.includes('placeholder')) {
          try {
            imageUrl = imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, url).href;
          } catch {
            // Invalid URL
          }
        }
      }

      items.push({ name, description, price, category: categoryName, image_url: imageUrl });
      categories.add(categoryName);
    });
  });

  logger.info('[SCRAPER] Complete:', { items: items.length, categories: categories.size });

  return {
    items,
    venueName,
    categories: Array.from(categories),
  };
}

