import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for scraping

interface ScrapedItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
}

/**
 * Scrape menu using Puppeteer for JavaScript-rendered sites
 */
async function scrapeWithPuppeteer(url: string): Promise<string> {
  try {
    // Dynamic import to avoid bundling issues
    const puppeteer = await import('puppeteer-core');
    const chromium = await import('@sparticuz/chromium');

    console.log('🤖 [PUPPETEER] Launching browser...');

    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    });

    const page = await browser.newPage();
    
    console.log('🤖 [PUPPETEER] Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for menu content to load
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    await browser.close();
    
    console.log('✅ [PUPPETEER] HTML retrieved, length:', html.length);
    return html;
  } catch (error) {
    console.error('❌ [PUPPETEER] Error:', error);
    throw new Error('Failed to render JavaScript content');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, venueId } = await req.json();

    if (!url || !venueId) {
      return NextResponse.json(
        { error: 'URL and venueId are required' },
        { status: 400 }
      );
    }

    console.log('🌐 [MENU IMPORT] Starting scrape for:', url);
    console.log('🌐 [MENU IMPORT] Venue ID:', venueId);

    let html: string;
    let usedPuppeteer = false;

    // Try static HTML first
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      html = await response.text();
      console.log('✅ [MENU IMPORT] Static HTML fetched, length:', html.length);

      // Check if it's a JavaScript-rendered site (lots of "Loading..." or minimal content)
      if (html.includes('Loading...') || html.length < 5000) {
        console.log('🤖 [MENU IMPORT] Detected JS-rendered site, using Puppeteer...');
        html = await scrapeWithPuppeteer(url);
        usedPuppeteer = true;
      }
    } catch (error) {
      console.warn('⚠️ [MENU IMPORT] Static fetch failed, trying Puppeteer...', error);
      html = await scrapeWithPuppeteer(url);
      usedPuppeteer = true;
    }

    const $ = cheerio.load(html);
    const items: ScrapedItem[] = [];
    const categories = new Set<string>();
    let venueName = 'Imported Menu';

    // Extract venue name from title or heading
    const titleText = $('title').text() || $('h1').first().text();
    if (titleText) {
      venueName = titleText.replace(/menu|Menu|MENU|-|–/gi, '').trim() || venueName;
    }

    console.log('🏪 [MENU IMPORT] Venue name:', venueName);
    console.log('🏪 [MENU IMPORT] Used Puppeteer:', usedPuppeteer);

    // Strategy 1: Check for JSON-LD structured data (best quality)
    const jsonLdScript = $('script[type="application/ld+json"]');
    if (jsonLdScript.length > 0) {
      console.log('🎯 [MENU IMPORT] Found JSON-LD data, parsing...');
      try {
        const jsonData = JSON.parse(jsonLdScript.first().html() || '{}');
        if (jsonData.hasMenu || jsonData.menu || jsonData['@type'] === 'Restaurant') {
          // Parse structured menu data
          console.log('✅ [MENU IMPORT] JSON-LD menu data found');
        }
      } catch (e) {
        console.log('⚠️ [MENU IMPORT] JSON-LD parse failed');
      }
    }

    // Strategy 2: Look for common menu item patterns
    // Try to find menu sections/categories
    const menuSections = $('section, .menu-section, .category, [class*="menu"], [class*="category"], [class*="section"]');
    
    console.log('📋 [MENU IMPORT] Found potential sections:', menuSections.length);

    menuSections.each((_, section) => {
      const $section = $(section);
      
      // Try to find category name - Enhanced patterns
      const categoryName = 
        $section.find('h2, h3, h4, .category-name, [class*="category-title"], [class*="section-title"]').first().text().trim() ||
        $section.find('[class*="heading"]').first().text().trim() ||
        $section.attr('data-category') ||
        $section.attr('aria-label') ||
        'Uncategorized';

      // Skip if category name is too generic or empty
      if (!categoryName || categoryName.length < 2) return;

      console.log('📁 [MENU IMPORT] Processing category:', categoryName);

      // Find menu items within this section - Enhanced selectors
      const itemElements = $section.find(
        '.menu-item, .item, .product, .dish, ' +
        '[class*="menu-item"], [class*="product"], [class*="dish"], [class*="item-card"], ' +
        '[data-item], [data-product], article, .card'
      );
      
      console.log('  📦 [MENU IMPORT] Found elements in category:', itemElements.length);

      itemElements.each((_, itemEl) => {
        const $item = $(itemEl);

        // Extract item name - Enhanced patterns
        const name = 
          $item.find('h3, h4, h5, .item-name, .product-name, .dish-name, [class*="title"], [class*="name"]').first().text().trim() ||
          $item.find('strong, b').first().text().trim() ||
          $item.attr('data-name') ||
          '';

        if (!name || name.length < 2) return; // Skip if no valid name found

        // Extract description - Enhanced patterns
        const description =
          $item.find('p, .description, .item-description, [class*="desc"], [class*="detail"]').first().text().trim() ||
          $item.find('.text, span').not('[class*="price"]').first().text().trim() ||
          '';

        // Extract price - Enhanced regex for multiple currency formats
        const priceText = 
          $item.find('.price, .item-price, [class*="price"], [data-price]').first().text() ||
          $item.text();
        
        // Match £, $, €, or plain numbers
        const priceMatch = priceText.match(/[£$€]?\s*(\d+(?:[.,]\d{2})?)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;

        // Skip items with no price or unrealistic prices
        if (price < 0.5 || price > 500) return;

        // Extract image URL - Enhanced patterns
        let imageUrl: string | undefined;
        const img = $item.find('img').first();
        if (img.length) {
          const imgSrc = 
            img.attr('src') || 
            img.attr('data-src') || 
            img.attr('data-lazy-src') ||
            img.attr('srcset')?.split(',')[0].trim().split(' ')[0];
          
          if (imgSrc && !imgSrc.includes('placeholder') && !imgSrc.includes('blank')) {
            try {
              // Handle relative URLs
              imageUrl = imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, url).href;
            } catch {
              // Invalid URL, skip
            }
          }
        }

        items.push({
          name,
          description: description || `Delicious ${name}`,
          price,
          category: categoryName,
          image_url: imageUrl,
        });
        categories.add(categoryName);
        console.log(`  ✅ [MENU IMPORT] ${name} - £${price}${imageUrl ? ' 📸' : ''}`);
      });
    });

    // Strategy 3: If no items found with structured approach, try general scraping
    if (items.length === 0) {
      console.log('🔍 [MENU IMPORT] Trying general scraping strategy...');

      // Look for any elements that might contain menu items
      $('li, div, article, [class*="item"], [class*="product"], [class*="card"]').each((_, el) => {
        const $el = $(el);
        const text = $el.text();
        
        // Must have reasonable length (not just a price tag)
        if (text.length < 10 || text.length > 500) return;
        
        // Look for price pattern in text
        const priceMatch = text.match(/[£$€]\s*(\d+(?:[.,]\d{2})?)/);
        if (!priceMatch) return;

        const price = parseFloat(priceMatch[1].replace(',', '.'));
        if (price < 0.5 || price > 300) return; // Reasonable price range

        // Extract name (text before price or heading)
        const heading = $el.find('h3, h4, h5, strong, b, [class*="title"], [class*="name"]').first().text().trim();
        const name = heading || text.split(/[£$€]/)[0].trim().split('\n')[0].trim();

        if (!name || name.length < 3 || name.length > 100) return;

        // Extract description - text that's not the name or price
        let description = $el.find('p, .description, [class*="desc"], span').not(':has(h3,h4,h5)').first().text().trim();
        if (!description) {
          // Try to extract from full text
          const parts = text.split('\n').filter(p => p.trim().length > 0);
          description = parts[1] || parts[0] || '';
        }
        // Clean description
        description = description.replace(name, '').replace(/[£$€]\s*\d+[.,]?\d*/g, '').trim();

        // Try to determine category from parent sections
        let category = 'Menu Items';
        const parents = $el.parents('section, div[class*="section"], div[class*="category"]');
        if (parents.length > 0) {
          const categoryHeading = parents.first().find('h2, h3, h4').first().text().trim();
          if (categoryHeading && categoryHeading.length > 0 && categoryHeading.length < 50) {
            category = categoryHeading;
          }
        }

        // Extract image
        let imageUrl: string | undefined;
        const img = $el.find('img').first();
        if (img.length) {
          const imgSrc = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
          if (imgSrc && !imgSrc.includes('placeholder') && !imgSrc.includes('blank')) {
            try {
              imageUrl = imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, url).href;
            } catch {
              // Invalid URL
            }
          }
        }

        // Check for duplicates
        const isDuplicate = items.some(item => 
          item.name.toLowerCase() === name.toLowerCase() && 
          item.price === price
        );

        if (!isDuplicate) {
          items.push({
            name,
            description: description || `Delicious ${name}`,
            price,
            category,
            image_url: imageUrl,
          });
          categories.add(category);
          console.log(`  ✅ [GENERAL] ${name} - £${price}${imageUrl ? ' 📸' : ''}`);
        }
      });
    }

    // Strategy 4: Try data attributes and React/Vue rendered content
    if (items.length === 0 && usedPuppeteer) {
      console.log('🔍 [MENU IMPORT] Trying React/Vue rendered content...');
      
      $('[data-testid*="item"], [data-testid*="product"], [data-item-name]').each((_, el) => {
        const $el = $(el);
        const name = $el.attr('data-item-name') || $el.find('[class*="name"]').first().text().trim();
        const priceStr = $el.attr('data-price') || $el.find('[class*="price"]').first().text();
        const category = $el.attr('data-category') || 'Menu Items';
        
        const priceMatch = priceStr?.match(/(\d+(?:[.,]\d{2})?)/);
        if (!priceMatch || !name) return;
        
        const price = parseFloat(priceMatch[1].replace(',', '.'));
        if (price < 0.5) return;

        const description = $el.find('[class*="desc"]').first().text().trim() || '';
        const imgSrc = $el.find('img').first().attr('src');
        const imageUrl = imgSrc && imgSrc.startsWith('http') ? imgSrc : undefined;

        items.push({
          name,
          description: description || `Delicious ${name}`,
          price,
          category,
          image_url: imageUrl,
        });
        categories.add(category);
      });
    }

    console.log('📊 [MENU IMPORT] Scraping complete');
    console.log('📊 [MENU IMPORT] Total items:', items.length);
    console.log('📊 [MENU IMPORT] Categories:', categories.size);
    console.log('📊 [MENU IMPORT] Items with images:', items.filter(i => i.image_url).length);

    if (items.length === 0) {
      return NextResponse.json(
        { 
          error: 'No menu items found. The website might be JavaScript-rendered or use a non-standard format. Try uploading a PDF instead.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      menuData: {
        items,
        venueName,
        categories: Array.from(categories),
        imageCount: items.filter(i => i.image_url).length,
      },
    });
  } catch (error) {
    console.error('❌ [MENU IMPORT] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to import menu from URL',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

