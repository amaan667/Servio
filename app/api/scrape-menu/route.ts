import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import puppeteer from "puppeteer";

/**
 * Scrape Menu from URL using Puppeteer
 * Extracts menu items, prices, descriptions, and images
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  let browser;
  
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { ok: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    console.info(`🌐 [SCRAPE MENU ${requestId}] Scraping: ${url}`);
    logger.info(`[MENU SCRAPE] Starting scrape`, { url, requestId });

    // Launch Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    console.info(`📄 [SCRAPE MENU ${requestId}] Navigating to URL...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    console.info(`🔍 [SCRAPE MENU ${requestId}] Extracting menu data...`);
    
    // Extract menu items using intelligent selectors
    const menuItems = await page.evaluate(() => {
      const items: Array<{
        name: string;
        description?: string;
        price?: number;
        category?: string;
        image?: string;
      }> = [];

      // Common menu item selectors (adapt based on website structure)
      const itemSelectors = [
        '.menu-item',
        '.dish',
        '[class*="menu"]',
        '[class*="item"]',
        '[data-testid*="menu"]',
        'article',
        '.product'
      ];

      let itemElements: Element[] = [];
      
      // Try each selector until we find menu items
      for (const selector of itemSelectors) {
        itemElements = Array.from(document.querySelectorAll(selector));
        if (itemElements.length > 0) {
          console.log(`Found ${itemElements.length} items using selector: ${selector}`);
          break;
        }
      }

      // If no structured items found, try to extract from text content
      if (itemElements.length === 0) {
        // Fallback: Look for price patterns (£X.XX, $X.XX)
        const bodyText = document.body.innerText;
        const pricePattern = /([A-Za-z\s&'-]+)\s*[.…]\s*(?:£|$|€)\s*(\d+\.?\d*)/g;
        let match;
        
        while ((match = pricePattern.exec(bodyText)) !== null) {
          const name = match[1].trim();
          const price = parseFloat(match[2]);
          
          if (name.length > 2 && name.length < 100 && price > 0 && price < 1000) {
            items.push({ name, price });
          }
        }
        
        return items;
      }

      // Extract data from structured elements
      itemElements.forEach((element) => {
        try {
          // Extract name
          const nameElement = element.querySelector('[class*="name"], [class*="title"], h1, h2, h3, h4, strong, b');
          const name = nameElement?.textContent?.trim() || '';

          if (!name || name.length < 2) return;

          // Extract price
          const priceElement = element.querySelector('[class*="price"], [data-testid*="price"], .price, span');
          const priceText = priceElement?.textContent?.trim() || '';
          const priceMatch = priceText.match(/(?:£|$|€)\s*(\d+\.?\d*)/);
          const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;

          // Extract description
          const descElement = element.querySelector('[class*="description"], [class*="desc"], p');
          const description = descElement?.textContent?.trim() || undefined;

          // Extract image
          const imgElement = element.querySelector('img');
          let image = imgElement?.src || imgElement?.getAttribute('data-src') || undefined;
          
          // Convert relative URLs to absolute
          if (image && !image.startsWith('http')) {
            image = new URL(image, window.location.href).href;
          }

          // Extract category (if available)
          let category;
          const categoryElement = element.closest('[class*="category"]')?.querySelector('[class*="heading"], h2, h3');
          category = categoryElement?.textContent?.trim() || undefined;

          items.push({
            name,
            description,
            price,
            category,
            image
          });
        } catch (err) {
          // Skip invalid items
        }
      });

      return items;
    });

    await browser.close();

    console.info(`✅ [SCRAPE MENU ${requestId}] Extracted ${menuItems.length} items from URL`);
    logger.info(`[MENU SCRAPE] Extraction complete`, { 
      itemCount: menuItems.length,
      requestId 
    });

    // Step 3: Use OpenAI to intelligently match PDF items with URL items
    console.info(`🤖 [SCRAPE MENU ${requestId}] Matching items with AI...`);
    
    const matchingPrompt = `Compare and match these menu items from two sources.

PDF Items (Source of Truth):
${JSON.stringify(existingItems.slice(0, 50), null, 2)}

URL Items (Updates):
${JSON.stringify(menuItems.slice(0, 50), null, 2)}

For each PDF item, find the best matching URL item (if any) and decide what to update:
1. Match by name similarity (fuzzy match, ignore case, punctuation)
2. If prices differ, use URL price (more current)
3. If URL has description and PDF doesn't, add it
4. If URL has image and PDF doesn't, add it
5. Merge categories intelligently

Return JSON with this exact structure:
{
  "matches": [{
    "pdf_id": "uuid",
    "pdf_name": "Original Name",
    "url_match": {"name": "...", "price": ..., "description": "...", "image": "..."},
    "confidence": 0.95,
    "updates_needed": {
      "price": true/false,
      "description": true/false,
      "image": true/false,
      "new_price": number or null,
      "new_description": string or null,
      "new_image": string or null
    }
  }],
  "new_items": [list of URL items with no PDF match],
  "unmatched_pdf": [list of PDF items with no URL match]
}`;

    const matchResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a menu matching expert. Return ONLY valid JSON." },
        { role: "user", content: matchingPrompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const matchData = JSON.parse(matchResponse.choices[0]?.message?.content || '{}');
    
    console.info(`🤖 [SCRAPE MENU ${requestId}] AI Matching Results:`, {
      matches: matchData.matches?.length || 0,
      newItems: matchData.new_items?.length || 0,
      unmatched: matchData.unmatched_pdf?.length || 0
    });

    // Step 4: Apply updates to database
    console.info(`💾 [SCRAPE MENU ${requestId}] Applying updates...`);
    
    const stats = {
      items_updated: 0,
      prices_updated: 0,
      descriptions_added: 0,
      images_added: 0,
      new_items_added: 0
    };

    // Update matched items
    for (const match of (matchData.matches || [])) {
      if (match.confidence < 0.7) continue; // Skip low-confidence matches

      const updates: any = {};
      let hasUpdates = false;

      if (match.updates_needed.price && match.updates_needed.new_price) {
        updates.price = match.updates_needed.new_price;
        stats.prices_updated++;
        hasUpdates = true;
      }

      if (match.updates_needed.description && match.updates_needed.new_description) {
        updates.description = match.updates_needed.new_description;
        stats.descriptions_added++;
        hasUpdates = true;
      }

      if (match.updates_needed.image && match.updates_needed.new_image) {
        updates.image = match.updates_needed.new_image;
        stats.images_added++;
        hasUpdates = true;
      }

      if (hasUpdates) {
        updates.updated_at = new Date().toISOString();
        
        const { error } = await supabase
          .from('menu_items')
          .update(updates)
          .eq('id', match.pdf_id)
          .eq('venue_id', venueId);

        if (error) {
          console.error(`❌ [SCRAPE MENU ${requestId}] Update failed for ${match.pdf_name}:`, error);
        } else {
          stats.items_updated++;
          console.info(`✅ [SCRAPE MENU ${requestId}] Updated: ${match.pdf_name}`);
        }
      }
    }

    // Insert new items from URL
    if (matchData.new_items && matchData.new_items.length > 0) {
      const newItemsToInsert = matchData.new_items.map((item: any, index: number) => ({
        venue_id: venueId,
        name: item.name,
        description: item.description || null,
        price: item.price || 0,
        category: item.category || 'Other',
        image: item.image || null,
        is_available: true,
        position: existingItems.length + index,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('menu_items')
        .insert(newItemsToInsert);

      if (insertError) {
        console.error(`❌ [SCRAPE MENU ${requestId}] Insert failed:`, insertError);
      } else {
        stats.new_items_added = newItemsToInsert.length;
        console.info(`✅ [SCRAPE MENU ${requestId}] Added ${stats.new_items_added} new items`);
      }
    }

    console.info(`🎉 [SCRAPE MENU ${requestId}] Hybrid merge complete!`, stats);
    logger.info('[MENU SCRAPE] Merge complete', { stats, requestId });

    return NextResponse.json({
      ok: true,
      items: menuItems,
      stats,
      message: `Menu updated! ${stats.items_updated} items updated, ${stats.new_items_added} new items added`
    });

  } catch (error) {
    console.error(`❌ [SCRAPE MENU ${requestId}] Error:`, error);
    logger.error('[MENU SCRAPE] Error:', error);

    if (browser) {
      await browser.close().catch(() => {});
    }

    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to scrape menu'
    }, { status: 500 });
  }
}

