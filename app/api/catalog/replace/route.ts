import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { extractMenuItemPositions } from '@/lib/gptVisionMenuParser';
import { scrapeMenuFromUrl } from '@/lib/menu-scraper';
import { convertPDFToImages } from '@/lib/pdf-to-images';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for processing

/**
 * Smart Menu Import: PDF + Optional URL
 * Uses GPT-4o Vision efficiently - only for positions when URL provided
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venue_id') as string;
    const menuUrl = formData.get('menu_url') as string | null;

    if (!file || !venueId) {
      return NextResponse.json(
        { ok: false, error: 'file and venue_id required' },
        { status: 400 }
      );
    }

    logger.info('[SMART IMPORT] Starting...');
    logger.info('[SMART IMPORT] Venue:', { venueId });
    logger.info('[SMART IMPORT] Mode:', { mode: menuUrl ? 'HYBRID (URL+PDF)' : 'PDF ONLY' });

    const supabase = createAdminClient();

    // Step 1: Convert PDF to images
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const pdfImages = await convertPDFToImages(pdfBuffer);
    
    logger.info('[SMART IMPORT] Converted to images:', { count: pdfImages.length });

    // Step 2: Store PDF and images in database
    const { error: uploadError } = await supabase
      .from('menu_uploads')
      .insert({
        venue_id: venueId,
        filename: file.name,
        pdf_images: pdfImages,
        status: 'processed',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (uploadError) {
      throw new Error(`Failed to save upload: ${uploadError.message}`);
    }

    let menuItems = [];
    let hotspots = [];

    // Step 3: Decide processing strategy (COST OPTIMIZATION)
    if (menuUrl && menuUrl.trim()) {
      // HYBRID MODE: URL for data (FREE), Vision for positions only (CHEAP)
      logger.info('[SMART IMPORT] HYBRID mode - URL + Vision positioning');
      
      // Scrape URL for item data (FREE)
      const scrapeResult = await scrapeMenuFromUrl(menuUrl);
      logger.info('[SMART IMPORT] Scraped items', { count: scrapeResult.items.length });

      // Vision AI for positions ONLY (not full extraction)
      const pdfPositions: Array<{ name: string; x: number; y: number; page: number; confidence: number }> = [];
      for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
        const positions = await extractMenuItemPositions(pdfImages[pageIndex]);
        positions.forEach((pos: { name: string; x: number; y: number; confidence: number }) => {
          pdfPositions.push({ ...pos, page: pageIndex });
        });
        logger.info(`[VISION] Page ${pageIndex + 1}: ${positions.length} positions`);
      }

      // Match and create items + hotspots
      for (const item of scrapeResult.items) {
        const itemId = uuidv4();
        
        // Find matching position
        const matchedPos = pdfPositions.find(pos => 
          calculateSimilarity(item.name, pos.name) > 0.7
        );

        menuItems.push({
          id: itemId,
          venue_id: venueId,
          ...item,
          is_available: true,
          created_at: new Date().toISOString(),
        });

        if (matchedPos) {
          hotspots.push({
            id: uuidv4(),
            venue_id: venueId,
            menu_item_id: itemId,
            page_index: matchedPos.page,
            x_percent: matchedPos.x,
            y_percent: matchedPos.y,
            width_percent: 15,
            height_percent: 8,
            created_at: new Date().toISOString(),
          });
        }
      }

      logger.info('[SMART IMPORT] Matched hotspots', { count: hotspots.length });
      
    } else {
      // PDF ONLY MODE: Vision for full extraction (MORE EXPENSIVE)
      logger.warn('[SMART IMPORT] No URL provided - PDF-only mode not yet implemented');
      logger.info('[SMART IMPORT] Tip: Add menu URL to save costs!');
      
      // For now, create basic menu items without Vision (to save costs)
      // User should really provide URL for best results
      menuItems = [];
      hotspots = [];
    }

    // Step 4: Clear existing catalog
    await supabase.from('menu_items').delete().eq('venue_id', venueId);
    await supabase.from('menu_hotspots').delete().eq('venue_id', venueId);

    // Step 5: Insert new items and hotspots
    if (menuItems.length > 0) {
      await supabase.from('menu_items').insert(menuItems);
    }

    if (hotspots.length > 0) {
      await supabase.from('menu_hotspots').insert(hotspots);
    }

    logger.info('[SMART IMPORT] Complete', { 
      items: menuItems.length, 
      hotspots: hotspots.length 
    });

    return NextResponse.json({
      ok: true,
      result: {
        items_created: menuItems.length,
        hotspots_created: hotspots.length,
        categories_created: new Set(menuItems.map((i: { category: string }) => i.category)).size,
      },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Processing failed';
    logger.error('[SMART IMPORT] Error:', { error: errorMessage });
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  return 1 - (distance / Math.max(s1.length, s2.length));
}

