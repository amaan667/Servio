import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { extractMenuFromImage, extractMenuItemPositions } from '@/lib/gptVisionMenuParser';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for processing

/**
 * Complete PDF + Optional URL processing
 * Integrates existing Vision OCR with URL scraping
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const venueId = formData.get('venue_id') as string;
    const menuUrl = formData.get('menu_url') as string | null; // Optional URL

    if (!file || !venueId) {
      return NextResponse.json(
        { ok: false, error: 'file and venue_id required' },
        { status: 400 }
      );
    }

    console.log('📋 [CATALOG REPLACE] Starting...');
    console.log('📋 [CATALOG REPLACE] Venue:', venueId);
    console.log('📋 [CATALOG REPLACE] Has URL:', !!menuUrl);

    const supabase = createAdminClient();

    // Step 1: Upload PDF and convert to images (existing flow)
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    uploadFormData.append('venue_id', venueId);

    const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/menu/upload`, {
      method: 'POST',
      body: uploadFormData,
    });

    const uploadResult = await uploadResponse.json();
    
    if (!uploadResponse.ok || !uploadResult?.ok) {
      throw new Error(uploadResult?.error || 'Upload failed');
    }

    console.log('✅ [CATALOG REPLACE] PDF uploaded');

    // Step 2: Get PDF images from upload
    const { data: uploadData } = await supabase
      .from('menu_uploads')
      .select('pdf_images, pdf_images_cc')
      .eq('id', uploadResult.upload_id)
      .single();

    const pdfImages = uploadData?.pdf_images || uploadData?.pdf_images_cc || [];

    console.log('✅ [CATALOG REPLACE] PDF Images:', pdfImages.length);

    let scrapedItems = [];
    let venueName = '';

    // Step 3: If URL provided, scrape it
    if (menuUrl && menuUrl.trim()) {
      console.log('🌐 [CATALOG REPLACE] Scraping URL:', menuUrl);
      
      try {
        const scrapeModule = await import('@/lib/menu-scraper');
        const scrapeResult = await scrapeModule.scrapeMenuFromUrl(menuUrl);
        scrapedItems = scrapeResult.items || [];
        venueName = scrapeResult.venueName || '';
        
        console.log('✅ [CATALOG REPLACE] Scraped items:', scrapedItems.length);
      } catch (error) {
        console.warn('⚠️ [CATALOG REPLACE] URL scraping failed:', error);
        // Continue without URL data
      }
    }

    // Step 4: Process PDF with Vision AI
    let menuItems = [];
    let hotspots = [];

    if (scrapedItems.length > 0 && pdfImages.length > 0) {
      // HYBRID: Match URL data with PDF positions
      console.log('🔄 [CATALOG REPLACE] Using HYBRID mode (URL + PDF)');
      
      const pdfPositions = [];
      
      // Analyze each PDF page for positions
      for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
        try {
          const positions = await extractMenuItemPositions(pdfImages[pageIndex]);
          positions.forEach((pos: any) => {
            pdfPositions.push({
              ...pos,
              page: pageIndex,
            });
          });
          console.log(`  ✅ [VISION] Page ${pageIndex + 1}: ${positions.length} items`);
        } catch (error) {
          console.error(`  ❌ [VISION] Page ${pageIndex + 1} failed:`, error);
        }
      }

      // Match scraped items to PDF positions
      for (const scrapedItem of scrapedItems) {
        const itemId = uuidv4();
        
        // Find matching position
        let matchedPos = null;
        for (const pos of pdfPositions) {
          const similarity = calculateSimilarity(scrapedItem.name, pos.name);
          if (similarity > 0.7) {
            matchedPos = pos;
            break;
          }
        }

        // Add menu item with URL data
        menuItems.push({
          id: itemId,
          venue_id: venueId,
          name: scrapedItem.name,
          description: scrapedItem.description,
          price: scrapedItem.price,
          category: scrapedItem.category,
          image_url: scrapedItem.image_url,
          is_available: true,
          created_at: new Date().toISOString(),
        });

        // Add hotspot with Vision position
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
          console.log(`  ✅ [MATCH] ${scrapedItem.name} → (${matchedPos.x}%, ${matchedPos.y}%)`);
        }
      }

    } else {
      // PDF ONLY: Extract items from PDF with Vision
      console.log('📄 [CATALOG REPLACE] Using PDF-only mode');
      
      // Extract items from first PDF page
      // TODO: Download PDF image and extract
      console.log('⚠️ [CATALOG REPLACE] PDF-only extraction not yet implemented - need to download image first');
    }

    // Step 5: Clear existing catalog
    await supabase.from('menu_items').delete().eq('venue_id', venueId);
    await supabase.from('menu_hotspots').delete().eq('venue_id', venueId);

    // Step 6: Insert new items and hotspots
    if (menuItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('menu_items')
        .insert(menuItems);

      if (itemsError) {
        throw new Error(`Failed to insert items: ${itemsError.message}`);
      }
    }

    if (hotspots.length > 0) {
      const { error: hotspotsError } = await supabase
        .from('menu_hotspots')
        .insert(hotspots);

      if (hotspotsError) {
        throw new Error(`Failed to insert hotspots: ${hotspotsError.message}`);
      }
    }

    console.log('✅ [CATALOG REPLACE] Complete!');
    console.log(`📊 [CATALOG REPLACE] Items: ${menuItems.length}, Hotspots: ${hotspots.length}`);

    return NextResponse.json({
      ok: true,
      result: {
        items_created: menuItems.length,
        hotspots_created: hotspots.length,
        categories_created: new Set(menuItems.map(i => i.category)).size,
        extracted_text: venueName,
      },
    });

  } catch (error) {
    console.error('❌ [CATALOG REPLACE] Error:', error);
    logger.error('[CATALOG REPLACE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Processing failed' },
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

