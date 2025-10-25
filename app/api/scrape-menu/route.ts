import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import * as cheerio from "cheerio";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Scrape Menu from URL using Cheerio + GPT-4
 * Serverless-friendly, no Puppeteer needed
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
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

    // Step 1: Fetch the HTML content
    console.info(`📄 [SCRAPE MENU ${requestId}] Fetching HTML...`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.info(`✅ [SCRAPE MENU ${requestId}] HTML fetched (${html.length} chars)`);

    // Step 2: Parse HTML with Cheerio
    const $ = cheerio.load(html);
    
    // Log the page title for debugging
    const pageTitle = $('title').text();
    console.info(`📄 [SCRAPE MENU ${requestId}] Page title: ${pageTitle}`);
    
    // Remove script and style tags
    $('script, style, nav, header, footer, iframe').remove();
    
    // Get clean text content
    const bodyText = $('body').text();
    const cleanText = bodyText.replace(/\s+/g, ' ').trim();
    
    console.info(`📝 [SCRAPE MENU ${requestId}] Extracted text length: ${cleanText.length} chars`);
    console.info(`📝 [SCRAPE MENU ${requestId}] Text preview: ${cleanText.substring(0, 200)}...`);
    
    // Extract image URLs
    const imageUrls: string[] = [];
    $('img').each((_, img) => {
      let src = $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src');
      if (src) {
        // Convert relative to absolute
        if (!src.startsWith('http')) {
          try {
            src = new URL(src, url).href;
          } catch {
            // Invalid URL, skip
          }
        }
        if (src && src.startsWith('http')) {
          imageUrls.push(src);
        }
      }
    });

    console.info(`📷 [SCRAPE MENU ${requestId}] Found ${imageUrls.length} images`);

    // Step 3: Use GPT-4 to extract menu items
    console.info(`🤖 [SCRAPE MENU ${requestId}] Using AI to extract menu items...`);
    
    const truncatedText = cleanText.length > 30000 ? cleanText.substring(0, 30000) + '...' : cleanText;

    const extractionPrompt = `Extract ALL menu items from this restaurant menu text.

Menu Text:
${truncatedText}

Available Images:
${imageUrls.slice(0, 50).join('\n')}

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
          content: "You are a menu extraction expert. Extract ALL menu items. Return ONLY valid JSON."
        },
        {
          role: "user",
          content: extractionPrompt
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const aiContent = aiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('AI response was empty');
    }

    let menuItems;
    try {
      const parsed = JSON.parse(aiContent);
      menuItems = parsed.items || [];
    } catch (parseError) {
      console.error(`❌ [SCRAPE MENU ${requestId}] Failed to parse AI response:`, parseError);
      throw new Error('AI returned invalid JSON');
    }

    console.info(`✅ [SCRAPE MENU ${requestId}] Extracted ${menuItems.length} items`);
    logger.info('[MENU SCRAPE] Extraction complete', { itemCount: menuItems.length });

    return NextResponse.json({
      ok: true,
      items: menuItems,
      message: `Found ${menuItems.length} items from menu`
    });

  } catch (error) {
    console.error(`❌ [SCRAPE MENU ${requestId}] Error:`, error);
    logger.error('[MENU SCRAPE] Error:', error);

    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to scrape menu'
    }, { status: 500 });
  }
}
