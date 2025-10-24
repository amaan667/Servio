import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for vision processing

/**
 * Hybrid Menu Import: Combines URL scraping + PDF analysis
 * 
 * Process:
 * 1. Scrape menu URL for item data (names, prices, descriptions)
 * 2. Analyze PDF images with GPT-4 Vision to find item positions
 * 3. Match items from URL to positions in PDF
 * 4. Create perfectly positioned hotspots
 * 
 * Result: Beautiful PDF view with accurate add-to-cart buttons
 */

interface ScrapedItem {
  name: string;
  description: string;
  price: number;
  category: string;
  image_url?: string;
}

interface PDFItemPosition {
  name: string;
  page: number;
  x: number; // 0-100 (percentage)
  y: number; // 0-100 (percentage)
  confidence: number;
}

export async function POST(req: NextRequest) {
  try {
    const { url, venueId, pdfImages } = await req.json();

    if (!url || !venueId || !pdfImages || !Array.isArray(pdfImages)) {
      return NextResponse.json(
        { error: 'URL, venueId, and pdfImages are required' },
        { status: 400 }
      );
    }

    console.log('🔄 [HYBRID IMPORT] Starting hybrid import...');
    console.log('🔄 [HYBRID IMPORT] URL:', url);
    console.log('🔄 [HYBRID IMPORT] PDF Pages:', pdfImages.length);

    // Step 1: Scrape menu from URL (reuse existing endpoint)
    const scrapeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/menu/import-from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, venueId }),
    });

    if (!scrapeResponse.ok) {
      throw new Error('Failed to scrape menu from URL');
    }

    const scrapeData = await scrapeResponse.json();
    const scrapedItems: ScrapedItem[] = scrapeData.menuData?.items || [];

    console.log('✅ [HYBRID IMPORT] Scraped items:', scrapedItems.length);

    // Step 2: Use GPT-4 Vision to analyze PDF and find item positions
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const pdfPositions: PDFItemPosition[] = [];

    for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
      const imageUrl = pdfImages[pageIndex];
      
      console.log(`👁️ [VISION] Analyzing page ${pageIndex + 1}...`);

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this menu page and extract the position of each menu item. 
                  
For each item, provide:
1. Item name (exact text)
2. X coordinate (0-100, where 0 is left edge, 100 is right edge)
3. Y coordinate (0-100, where 0 is top, 100 is bottom)
4. Confidence (0-1)

Return as JSON array:
[
  {"name": "Item Name", "x": 25, "y": 30, "confidence": 0.95},
  ...
]

IMPORTANT: 
- Measure X,Y from the CENTER of where the item text appears
- Be precise - these coordinates will be used for clickable buttons
- If you see the item name in both English and another language, use the English name
- Only include actual menu items with prices, not headers/titles`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: 4000,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          // Extract JSON from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const positions = JSON.parse(jsonMatch[0]);
            positions.forEach((pos: { name: string; x: number; y: number; confidence: number }) => {
              pdfPositions.push({
                name: pos.name,
                page: pageIndex,
                x: pos.x,
                y: pos.y,
                confidence: pos.confidence || 0.8,
              });
            });
            console.log(`  ✅ [VISION] Found ${positions.length} items on page ${pageIndex + 1}`);
          }
        }
      } catch (error) {
        console.error(`❌ [VISION] Error analyzing page ${pageIndex + 1}:`, error);
      }
    }

    console.log('✅ [HYBRID IMPORT] Total positions found:', pdfPositions.length);

    // Step 3: Match scraped items with PDF positions using fuzzy matching
    const matchedItems = [];
    const unmatchedItems = [];

    for (const scrapedItem of scrapedItems) {
      // Find best matching position
      let bestMatch: PDFItemPosition | null = null;
      let bestScore = 0;

      for (const position of pdfPositions) {
        const score = calculateNameSimilarity(scrapedItem.name, position.name);
        if (score > bestScore && score > 0.7) { // 70% similarity threshold
          bestScore = score;
          bestMatch = position;
        }
      }

      if (bestMatch) {
        matchedItems.push({
          ...scrapedItem,
          page: bestMatch.page,
          x_percent: bestMatch.x,
          y_percent: bestMatch.y,
          confidence: bestMatch.confidence * bestScore,
        });
        console.log(`  ✅ [MATCH] "${scrapedItem.name}" → Position (${bestMatch.x}, ${bestMatch.y}) on page ${bestMatch.page + 1}`);
      } else {
        unmatchedItems.push(scrapedItem);
        console.log(`  ⚠️ [MATCH] "${scrapedItem.name}" - No position found`);
      }
    }

    console.log('📊 [HYBRID IMPORT] Matched items:', matchedItems.length);
    console.log('📊 [HYBRID IMPORT] Unmatched items:', unmatchedItems.length);

    return NextResponse.json({
      success: true,
      matchedItems,
      unmatchedItems,
      totalScraped: scrapedItems.length,
      totalPositions: pdfPositions.length,
      matchRate: (matchedItems.length / scrapedItems.length * 100).toFixed(1) + '%',
    });

  } catch (error) {
    console.error('❌ [HYBRID IMPORT] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process hybrid import',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate similarity between two strings (0-1)
 * Uses Levenshtein distance
 */
function calculateNameSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - (distance / maxLength);
}

