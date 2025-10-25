import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Scrape Menu from URL using GPT-4 Vision + HTML Parsing
 * Much more reliable than Puppeteer for serverless environments
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

    // Step 2: Use GPT-4 to extract menu items from HTML
    console.info(`🤖 [SCRAPE MENU ${requestId}] Using AI to extract menu items...`);
    
    // Truncate HTML if too long (GPT-4 context limit)
    const truncatedHtml = html.length > 50000 ? html.substring(0, 50000) + '...' : html;

    const extractionPrompt = `Extract all menu items from this restaurant menu HTML.
    
HTML Content:
${truncatedHtml}

Extract each menu item with:
- name: Item name (required)
- price: Price in pounds (number, no currency symbol)
- description: Item description (if available)
- category: Category/section name (if available)
- image: Image URL (if available, make absolute URLs)

Return ONLY valid JSON with this structure:
{
  "items": [
    {
      "name": "Eggs Benedict",
      "price": 12.50,
      "description": "Poached eggs on English muffin with hollandaise sauce",
      "category": "Breakfast",
      "image": "https://example.com/image.jpg"
    }
  ]
}

Be thorough - extract ALL menu items you can find.
If no items found, return {"items": []}.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a menu extraction expert. Extract ALL menu items from HTML. Return ONLY valid JSON, no markdown, no explanation."
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
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import * as cheerio from "cheerio";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Scrape Menu from URL using HTML Parsing + GPT-4
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

    // Step 2: Parse HTML with Cheerio to extract text content
    const $ = cheerio.load(html);
    
    // Remove script and style tags
    $('script, style, nav, header, footer').remove();
    
    // Get clean text content
    const bodyText = $('body').text();
    const cleanText = bodyText.replace(/\s+/g, ' ').trim();
    
    // Extract image URLs
    const imageUrls: string[] = [];
    $('img').each((_, img) => {
      let src = $(img).attr('src') || $(img).attr('data-src');
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

    // Step 3: Use GPT-4 to extract menu items from text
    console.info(`🤖 [SCRAPE MENU ${requestId}] Using AI to extract menu items...`);
    
    // Truncate text if too long (GPT-4 context limit)
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
- category: Category/section name (if available, e.g. "Breakfast", "Mains", "Desserts")
- image: Match an image URL if the item name appears near an image in the list

Return ONLY valid JSON with this structure:
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
}

Be thorough - extract ALL items. If no items found, return {"items": []}.`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a menu extraction expert. Extract ALL menu items from text. Return ONLY valid JSON, no markdown."
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

