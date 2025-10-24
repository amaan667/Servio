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
async function scrapeWithPuppeteer(url: string): Promise<string> {
  try {
    const puppeteer = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    await browser.close();
    
    return html;
  } catch (error) {
    logger.error('[SCRAPER] Puppeteer error:', error);
    throw new Error('Failed to render JavaScript content');
  }
}

export async function scrapeMenuFromUrl(url: string): Promise<ScrapeResult> {
  let html: string;

  // Try static HTML first
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    html = await response.text();

    // Check if JavaScript-rendered
    if (html.includes('Loading...') || html.length < 5000) {
      html = await scrapeWithPuppeteer(url);
    }
  } catch (error) {
    html = await scrapeWithPuppeteer(url);
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

