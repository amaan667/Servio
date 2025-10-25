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

    // Step 3: Check if this is a JavaScript-rendered site
    const isJSRendered = cleanText.includes('Loading...') || 
                        cleanText.includes('__NEXT_DATA__') ||
                        cleanText.includes('__nuxt') ||
                        html.includes('react') ||
                        cleanText.length < 500;

    let finalHtml = html;
    let finalText = cleanText;

    if (isJSRendered) {
      console.warn(`⚠️ [SCRAPE MENU ${requestId}] JavaScript-rendered site detected`);
      console.info(`🌐 [SCRAPE MENU ${requestId}] Using Browserless.io to render JavaScript...`);
      
      if (!process.env.BROWSERLESS_API_KEY) {
        console.error(`❌ [SCRAPE MENU ${requestId}] BROWSERLESS_API_KEY not configured`);
        return NextResponse.json({
          ok: false,
          error: `This website uses JavaScript to load menu content. Please add BROWSERLESS_API_KEY to environment variables to enable JavaScript rendering.
          
Setup Instructions:
1. Sign up at https://www.browserless.io/
2. Get your API key
3. Add to Railway: BROWSERLESS_API_KEY=your_key_here
4. Try again

Alternative: Manually update menu items in Menu Management.`
        }, { status: 400 });
      }

      try {
        // Use Browserless.io to render JavaScript
        const browserlessUrl = `https://chrome.browserless.io/content?token=${process.env.BROWSERLESS_API_KEY}`;
        
        console.info(`📡 [SCRAPE MENU ${requestId}] Requesting Browserless.io...`);
        const browserlessResponse = await fetch(browserlessUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            waitFor: 5000, // Wait 5 seconds for JS to load
            gotoOptions: {
              waitUntil: 'networkidle2'
            }
          })
        });

        if (!browserlessResponse.ok) {
          const errorText = await browserlessResponse.text();
          console.error(`❌ [SCRAPE MENU ${requestId}] Browserless failed:`, errorText);
          throw new Error(`Browserless request failed: ${browserlessResponse.status}`);
        }

        const browserlessData = await browserlessResponse.json();
        finalHtml = browserlessData.data || browserlessData;
        
        console.info(`✅ [SCRAPE MENU ${requestId}] Got rendered HTML from Browserless (${finalHtml.length} chars)`);
        
        // Re-parse the rendered HTML
        const $rendered = cheerio.load(finalHtml);
        $rendered('script, style, nav, header, footer, iframe').remove();
        finalText = $rendered('body').text().replace(/\s+/g, ' ').trim();
        
        console.info(`✅ [SCRAPE MENU ${requestId}] Rendered text length: ${finalText.length} chars`);
        console.info(`✅ [SCRAPE MENU ${requestId}] Rendered preview: ${finalText.substring(0, 300)}...`);
        
        // Extract images from rendered HTML
        imageUrls.length = 0; // Clear previous images
        $rendered('img').each((_, img) => {
          let src = $rendered(img).attr('src') || $rendered(img).attr('data-src');
          if (src) {
            if (!src.startsWith('http')) {
              try {
                src = new URL(src, url).href;
              } catch {
                // Invalid
              }
            }
            if (src && src.startsWith('http')) {
              imageUrls.push(src);
            }
          }
        });
        
        console.info(`📷 [SCRAPE MENU ${requestId}] Images from rendered page: ${imageUrls.length}`);
      } catch (browserlessError) {
        console.error(`❌ [SCRAPE MENU ${requestId}] Browserless rendering failed:`, browserlessError);
        return NextResponse.json({
          ok: false,
          error: `Failed to render JavaScript site. Error: ${browserlessError instanceof Error ? browserlessError.message : 'Unknown error'}`
        }, { status: 500 });
      }
    }

    // Step 4: Use GPT-4 to extract menu items (from rendered or static HTML)
    console.info(`🤖 [SCRAPE MENU ${requestId}] Using AI to extract menu items...`);
    
    const truncatedText = finalText.length > 30000 ? finalText.substring(0, 30000) + '...' : finalText;

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
