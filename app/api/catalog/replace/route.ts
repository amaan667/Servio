import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { extractMenuFromImage, extractMenuItemPositions } from '@/lib/gptVisionMenuParser';
import { scrapeMenuFromUrl } from '@/lib/menu-scraper';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for processing

/**
 * Unified Menu Import: PDF + Optional URL
 * Combines data from both sources for best results
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`🚀 [CATALOG REPLACE ${requestId}] ========================================`);
    console.log(`🚀 [CATALOG REPLACE ${requestId}] New request started`);
    console.log(`🚀 [CATALOG REPLACE ${requestId}] Timestamp:`, new Date().toISOString());
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venue_id') as string;
    const menuUrl = formData.get('menu_url') as string | null;
    const replaceMode = formData.get('replace_mode') !== 'false'; // Default to true

    console.log(`📋 [CATALOG REPLACE ${requestId}] Venue ID:`, venueId);
    console.log(`📋 [CATALOG REPLACE ${requestId}] File:`, file?.name, `(${file?.size} bytes)`);
    console.log(`📋 [CATALOG REPLACE ${requestId}] Menu URL:`, menuUrl || 'None');
    console.log(`📋 [CATALOG REPLACE ${requestId}] Mode:`, replaceMode ? 'REPLACE' : 'APPEND');

    if (!file || !venueId) {
      console.error(`❌ [CATALOG REPLACE ${requestId}] Missing required fields`);
      return NextResponse.json(
        { ok: false, error: 'file and venue_id required' },
        { status: 400 }
      );
    }

    logger.info(`[MENU IMPORT ${requestId}] Starting...`);
    logger.info(`[MENU IMPORT ${requestId}] Venue:`, { venueId });
    logger.info(`[MENU IMPORT ${requestId}] Has URL:`, { hasUrl: !!menuUrl });

    const supabase = createAdminClient();

    // Step 1: Convert PDF to images (serverless-friendly)
    console.log(`📄 [CATALOG REPLACE ${requestId}] Converting PDF to images...`);
    const pdfBuffer = Buffer.from(await file.arrayBuffer());
    
    let pdfImages: string[] = [];
    try {
      const { convertPDFToImages } = await import('@/lib/pdf-to-images-serverless');
      pdfImages = await convertPDFToImages(pdfBuffer);
      console.log(`✅ [CATALOG REPLACE ${requestId}] PDF converted: ${pdfImages.length} pages`);
      logger.info(`[MENU IMPORT ${requestId}] Converted to images:`, { count: pdfImages.length });
    } catch (conversionError) {
      console.error(`❌ [CATALOG REPLACE ${requestId}] PDF conversion failed:`, conversionError);
      logger.error(`[MENU IMPORT ${requestId}] Conversion error:`, conversionError);
      throw new Error('PDF to image conversion failed - please check Railway logs');
    }

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
    console.log(`🔍 [CATALOG REPLACE ${requestId}] Starting extraction phase...`);
    const urlItems: Array<any> = [];
    const pdfExtractedItems: Array<any> = [];
    const pdfPositions: Array<{ name: string; x: number; y: number; page: number; confidence: number }> = [];

    // Extract from URL if provided
    if (menuUrl && menuUrl.trim()) {
      console.log(`🌐 [CATALOG REPLACE ${requestId}] Extracting from URL:`, menuUrl);
      logger.info(`[MENU IMPORT ${requestId}] Extracting from URL...`);
      try {
        const scrapeResult = await scrapeMenuFromUrl(menuUrl);
        urlItems.push(...scrapeResult.items);
        console.log(`✅ [CATALOG REPLACE ${requestId}] URL extracted: ${urlItems.length} items`);
        logger.info(`[MENU IMPORT ${requestId}] URL items:`, { count: urlItems.length });
      } catch (error) {
        console.warn(`⚠️ [CATALOG REPLACE ${requestId}] URL scraping failed:`, error instanceof Error ? error.message : String(error));
        logger.warn(`[MENU IMPORT ${requestId}] URL scraping failed, using PDF-only`);
        // Continue with PDF-only extraction
      }
    }

    // Extract from PDF using Vision AI
    console.log(`👁️ [CATALOG REPLACE ${requestId}] Extracting from PDF with Vision AI...`);
    logger.info(`[MENU IMPORT ${requestId}] Extracting from PDF with Vision AI...`);
    for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
      console.log(`👁️ [CATALOG REPLACE ${requestId}] Processing page ${pageIndex + 1}/${pdfImages.length}...`);
      
      // Get item data from Vision
      const extractedItems = await extractMenuFromImage(pdfImages[pageIndex]);
      // Don't add 'page' to items - track it separately
      pdfExtractedItems.push(...extractedItems);
      
      // Get positions from Vision (now with bounding boxes)
      const positions = await extractMenuItemPositions(pdfImages[pageIndex]);
      positions.forEach((pos: { name: string; x: number; y: number; x1: number; y1: number; x2: number; y2: number; confidence: number }) => {
        pdfPositions.push({ ...pos, page: pageIndex });
      });
      
      console.log(`✅ [CATALOG REPLACE ${requestId}] Page ${pageIndex + 1}: ${extractedItems.length} items, ${positions.length} positions`);
      logger.info(`[MENU IMPORT ${requestId}] Page ${pageIndex + 1}: ${extractedItems.length} items, ${positions.length} positions`);
    }

    console.log(`📊 [CATALOG REPLACE ${requestId}] Extraction complete - PDF items: ${pdfExtractedItems.length}, positions: ${pdfPositions.length}`);
    logger.info(`[MENU IMPORT ${requestId}] PDF items:`, { count: pdfExtractedItems.length });
    logger.info(`[MENU IMPORT ${requestId}] PDF positions:`, { count: pdfPositions.length });

    // Step 4: Combine data intelligently
    console.log(`🔄 [CATALOG REPLACE ${requestId}] Starting data combination...`);
    const menuItems = [];
    const hotspots = [];
    const combinedItems = new Map();
    let itemPosition = 0; // Track insertion order for proper sorting

    // If we have both URL and PDF data, merge them
    if (urlItems.length > 0 && pdfExtractedItems.length > 0) {
      console.log(`🔄 [CATALOG REPLACE ${requestId}] HYBRID MODE: Combining URL and PDF data...`);
      logger.info(`[MENU IMPORT ${requestId}] Combining URL and PDF data...`);
      
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
          position: itemPosition++,
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
            width_percent: posMatch.x2 - posMatch.x1,
            height_percent: posMatch.y2 - posMatch.y1,
            // Bounding box coordinates (new columns)
            x1_percent: posMatch.x1,
            y1_percent: posMatch.y1,
            x2_percent: posMatch.x2,
            y2_percent: posMatch.y2,
            is_active: true,
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
            name: pdfItem.name,
            description: pdfItem.description || '',
            price: pdfItem.price,
            category: pdfItem.category,
            image_url: pdfItem.image_url || null,
            is_available: true,
            position: itemPosition++,
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
              width_percent: posMatch.x2 - posMatch.x1,
              height_percent: posMatch.y2 - posMatch.y1,
              // Store bounding box for overlay cards
              x1_percent: posMatch.x1,
              y1_percent: posMatch.y1,
              x2_percent: posMatch.x2,
              y2_percent: posMatch.y2,
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
          name: item.name,
          description: item.description || '',
          price: item.price,
          category: item.category,
          image_url: item.image_url || null,
          is_available: true,
          position: itemPosition++,
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
            width_percent: posMatch.x2 - posMatch.x1,
            height_percent: posMatch.y2 - posMatch.y1,
            // Bounding box coordinates (new columns)
            x1_percent: posMatch.x1,
            y1_percent: posMatch.y1,
            x2_percent: posMatch.x2,
            y2_percent: posMatch.y2,
            is_active: true,
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
          name: item.name,
          description: item.description || '',
          price: item.price,
          category: item.category,
          image_url: item.image_url || null,
          is_available: true,
          position: itemPosition++,
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
            width_percent: posMatch.x2 - posMatch.x1,
            height_percent: posMatch.y2 - posMatch.y1,
            // Bounding box coordinates (new columns)
            x1_percent: posMatch.x1,
            y1_percent: posMatch.y1,
            x2_percent: posMatch.x2,
            y2_percent: posMatch.y2,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // Step 4: Clear existing catalog (if replace mode)
    if (replaceMode) {
      console.log(`🗑️ [CATALOG REPLACE ${requestId}] REPLACE MODE - Deleting old menu items...`);
      const { error: deleteItemsError } = await supabase.from('menu_items').delete().eq('venue_id', venueId);
      if (deleteItemsError) {
        console.error(`❌ [CATALOG REPLACE ${requestId}] Failed to delete items:`, deleteItemsError);
        throw new Error(`Failed to delete old items: ${deleteItemsError.message}`);
      }
      console.log(`✅ [CATALOG REPLACE ${requestId}] Old items deleted`);

      console.log(`🗑️ [CATALOG REPLACE ${requestId}] Deleting old hotspots...`);
      const { error: deleteHotspotsError } = await supabase.from('menu_hotspots').delete().eq('venue_id', venueId);
      if (deleteHotspotsError) {
        console.error(`❌ [CATALOG REPLACE ${requestId}] Failed to delete hotspots:`, deleteHotspotsError);
        throw new Error(`Failed to delete old hotspots: ${deleteHotspotsError.message}`);
      }
      console.log(`✅ [CATALOG REPLACE ${requestId}] Old hotspots deleted`);
    } else {
      console.log(`➕ [CATALOG REPLACE ${requestId}] APPEND MODE - Keeping existing items`);
    }

    // Step 5: Extract and preserve category order
    const categoryOrder: string[] = [];
    const seenCategories = new Set<string>();
    
    // Preserve order from Vision AI extraction (matches PDF order)
    for (const item of pdfExtractedItems) {
      if (item.category && !seenCategories.has(item.category)) {
        categoryOrder.push(item.category);
        seenCategories.add(item.category);
      }
    }
    
    // Add URL categories if any new ones
    for (const item of urlItems) {
      if (item.category && !seenCategories.has(item.category)) {
        categoryOrder.push(item.category);
        seenCategories.add(item.category);
      }
    }
    
    console.log(`📋 [CATALOG REPLACE ${requestId}] Category order:`, categoryOrder);

    // Step 6: Insert new items and hotspots
    if (menuItems.length > 0) {
      console.log(`💾 [CATALOG REPLACE ${requestId}] Inserting ${menuItems.length} new items...`);
      const { error: insertItemsError, data: insertedItems } = await supabase.from('menu_items').insert(menuItems).select();
      if (insertItemsError) {
        console.error(`❌ [CATALOG REPLACE ${requestId}] Failed to insert items:`, insertItemsError);
        throw new Error(`Failed to insert items: ${insertItemsError.message}`);
      }
      console.log(`✅ [CATALOG REPLACE ${requestId}] Inserted ${insertedItems?.length || 0} items`);
    }

    if (hotspots.length > 0) {
      console.log(`💾 [CATALOG REPLACE ${requestId}] Inserting ${hotspots.length} hotspots...`);
      const { error: insertHotspotsError, data: insertedHotspots } = await supabase.from('menu_hotspots').insert(hotspots).select();
      if (insertHotspotsError) {
        console.error(`❌ [CATALOG REPLACE ${requestId}] Failed to insert hotspots:`, insertHotspotsError);
        throw new Error(`Failed to insert hotspots: ${insertHotspotsError.message}`);
      }
      console.log(`✅ [CATALOG REPLACE ${requestId}] Inserted ${insertedHotspots?.length || 0} hotspots`);
    }

    // Step 7: Save category order to menu_uploads
    if (categoryOrder.length > 0) {
      console.log(`💾 [CATALOG REPLACE ${requestId}] Saving category order...`);
      await supabase
        .from('menu_uploads')
        .update({ category_order: categoryOrder })
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(1);
      console.log(`✅ [CATALOG REPLACE ${requestId}] Category order saved:`, categoryOrder);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [CATALOG REPLACE ${requestId}] ========================================`);
    console.log(`✅ [CATALOG REPLACE ${requestId}] SUCCESS! Completed in ${duration}ms`);
    console.log(`✅ [CATALOG REPLACE ${requestId}] Items: ${menuItems.length}, Hotspots: ${hotspots.length}`);
    console.log(`✅ [CATALOG REPLACE ${requestId}] Sources - URL: ${urlItems.length}, PDF: ${pdfExtractedItems.length}`);
    
    logger.info(`[MENU IMPORT ${requestId}] Complete`, { 
      items: menuItems.length, 
      hotspots: hotspots.length,
      duration,
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
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Processing failed';
    console.error(`❌ [CATALOG REPLACE ${requestId}] ========================================`);
    console.error(`❌ [CATALOG REPLACE ${requestId}] FAILED after ${duration}ms`);
    console.error(`❌ [CATALOG REPLACE ${requestId}] Error:`, errorMessage);
    console.error(`❌ [CATALOG REPLACE ${requestId}] Stack:`, err instanceof Error ? err.stack : 'No stack');
    
    logger.error(`[MENU IMPORT ${requestId}] Error:`, { error: errorMessage, duration });
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

