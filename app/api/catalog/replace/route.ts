import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { extractMenuFromImage, extractMenuItemPositions } from '@/lib/gptVisionMenuParser';
import { scrapeMenuFromUrl } from '@/lib/menu-scraper';
import { convertPDFToImages } from '@/lib/pdf-to-images';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for processing

/**
 * Unified Menu Import: PDF + Optional URL
 * Combines data from both sources for best results
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

    logger.info('[MENU IMPORT] Starting...');
    logger.info('[MENU IMPORT] Venue:', { venueId });
    logger.info('[MENU IMPORT] Has URL:', { hasUrl: !!menuUrl });

    const supabase = createAdminClient();

    // Step 1: Convert PDF to images
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    const pdfImages = await convertPDFToImages(pdfBuffer);
    
    logger.info('[MENU IMPORT] Converted to images:', { count: pdfImages.length });

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

    // Step 3: Extract data from all available sources
    const urlItems: Array<any> = [];
    const pdfExtractedItems: Array<any> = [];
    const pdfPositions: Array<{ name: string; x: number; y: number; page: number; confidence: number }> = [];

    // Extract from URL if provided
    if (menuUrl && menuUrl.trim()) {
      logger.info('[MENU IMPORT] Extracting from URL...');
      const scrapeResult = await scrapeMenuFromUrl(menuUrl);
      urlItems.push(...scrapeResult.items);
      logger.info('[MENU IMPORT] URL items:', { count: urlItems.length });
    }

    // Extract from PDF using Vision AI
    logger.info('[MENU IMPORT] Extracting from PDF with Vision AI...');
    for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
      // Get item data from Vision
      const extractedItems = await extractMenuFromImage(pdfImages[pageIndex]);
      pdfExtractedItems.push(...extractedItems.map((item: any) => ({ ...item, page: pageIndex })));
      
      // Get positions from Vision
      const positions = await extractMenuItemPositions(pdfImages[pageIndex]);
      positions.forEach((pos: { name: string; x: number; y: number; confidence: number }) => {
        pdfPositions.push({ ...pos, page: pageIndex });
      });
      
      logger.info(`[MENU IMPORT] Page ${pageIndex + 1}: ${extractedItems.length} items, ${positions.length} positions`);
    }

    logger.info('[MENU IMPORT] PDF items:', { count: pdfExtractedItems.length });
    logger.info('[MENU IMPORT] PDF positions:', { count: pdfPositions.length });

    // Step 4: Combine data intelligently
    const menuItems = [];
    const hotspots = [];
    const combinedItems = new Map();

    // If we have both URL and PDF data, merge them
    if (urlItems.length > 0 && pdfExtractedItems.length > 0) {
      logger.info('[MENU IMPORT] Combining URL and PDF data...');
      
      // Start with URL items (better data quality)
      for (const urlItem of urlItems) {
        const itemId = uuidv4();
        
        // Find matching PDF item for additional data
        const pdfMatch = pdfExtractedItems.find(pdfItem => 
          calculateSimilarity(urlItem.name, pdfItem.name) > 0.7
        );
        
        // Find matching position
        const posMatch = pdfPositions.find(pos => 
          calculateSimilarity(urlItem.name, pos.name) > 0.7
        );

        // Combine data: URL provides images/descriptions, PDF provides fallbacks
        menuItems.push({
          id: itemId,
          venue_id: venueId,
          name: urlItem.name,
          description: urlItem.description || pdfMatch?.description || '',
          price: urlItem.price || pdfMatch?.price || 0,
          category: urlItem.category || pdfMatch?.category || 'Menu Items',
          image_url: urlItem.image_url || null,
          is_available: true,
          created_at: new Date().toISOString(),
        });

        if (posMatch) {
          hotspots.push({
            id: uuidv4(),
            venue_id: venueId,
            menu_item_id: itemId,
            page_index: posMatch.page,
            x_percent: posMatch.x,
            y_percent: posMatch.y,
            width_percent: 15,
            height_percent: 8,
            created_at: new Date().toISOString(),
          });
        }
        
        combinedItems.set(urlItem.name.toLowerCase(), true);
      }

      // Add PDF items that weren't matched
      for (const pdfItem of pdfExtractedItems) {
        if (!combinedItems.has(pdfItem.name.toLowerCase())) {
          const itemId = uuidv4();
          
          const posMatch = pdfPositions.find(pos => 
            calculateSimilarity(pdfItem.name, pos.name) > 0.7
          );

          menuItems.push({
            id: itemId,
            venue_id: venueId,
            ...pdfItem,
            is_available: true,
            created_at: new Date().toISOString(),
          });

          if (posMatch) {
            hotspots.push({
              id: uuidv4(),
              venue_id: venueId,
              menu_item_id: itemId,
              page_index: posMatch.page,
              x_percent: posMatch.x,
              y_percent: posMatch.y,
              width_percent: 15,
              height_percent: 8,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
      
    } else if (urlItems.length > 0) {
      // URL only: use positions from Vision
      logger.info('[MENU IMPORT] Using URL data with PDF positions...');
      for (const item of urlItems) {
        const itemId = uuidv4();
        const posMatch = pdfPositions.find(pos => calculateSimilarity(item.name, pos.name) > 0.7);

        menuItems.push({
          id: itemId,
          venue_id: venueId,
          ...item,
          is_available: true,
          created_at: new Date().toISOString(),
        });

        if (posMatch) {
          hotspots.push({
            id: uuidv4(),
            venue_id: venueId,
            menu_item_id: itemId,
            page_index: posMatch.page,
            x_percent: posMatch.x,
            y_percent: posMatch.y,
            width_percent: 15,
            height_percent: 8,
            created_at: new Date().toISOString(),
          });
        }
      }
      
    } else {
      // PDF only: use extracted items with positions
      logger.info('[MENU IMPORT] Using PDF data only...');
      for (const item of pdfExtractedItems) {
        const itemId = uuidv4();
        const posMatch = pdfPositions.find(pos => calculateSimilarity(item.name, pos.name) > 0.7);

        menuItems.push({
          id: itemId,
          venue_id: venueId,
          ...item,
          is_available: true,
          created_at: new Date().toISOString(),
        });

        if (posMatch) {
          hotspots.push({
            id: uuidv4(),
            venue_id: venueId,
            menu_item_id: itemId,
            page_index: posMatch.page,
            x_percent: posMatch.x,
            y_percent: posMatch.y,
            width_percent: 15,
            height_percent: 8,
            created_at: new Date().toISOString(),
          });
        }
      }
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

    logger.info('[MENU IMPORT] Complete', { 
      items: menuItems.length, 
      hotspots: hotspots.length,
      sources: {
        url: urlItems.length,
        pdf: pdfExtractedItems.length,
        combined: menuItems.length
      }
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
    logger.error('[MENU IMPORT] Error:', { error: errorMessage });
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

