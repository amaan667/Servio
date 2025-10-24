import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { extractMenuItemPositions } from '@/lib/gptVisionMenuParser';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Regenerate hotspots with bounding boxes for existing menu
 * Useful for upgrading old point-based hotspots to new overlay cards
 */
export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const body = await req.json();
    const { venue_id: venueId } = body;

    console.log(`🔄 [REGEN HOTSPOTS ${requestId}] Starting for venue:`, venueId);

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'venue_id required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get existing PDF images
    const { data: uploadData } = await supabase
      .from('menu_uploads')
      .select('pdf_images, pdf_images_cc')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!uploadData || (!uploadData.pdf_images && !uploadData.pdf_images_cc)) {
      return NextResponse.json(
        { ok: false, error: 'No PDF found for this venue' },
        { status: 404 }
      );
    }

    const pdfImages = uploadData.pdf_images || uploadData.pdf_images_cc;
    console.log(`📄 [REGEN HOTSPOTS ${requestId}] Found ${pdfImages.length} PDF pages`);

    // Get existing menu items
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venueId);

    if (!menuItems || menuItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No menu items found for this venue' },
        { status: 404 }
      );
    }

    console.log(`📋 [REGEN HOTSPOTS ${requestId}] Found ${menuItems.length} menu items`);

    // Extract positions with bounding boxes from PDF
    const pdfPositions: Array<any> = [];
    for (let pageIndex = 0; pageIndex < pdfImages.length; pageIndex++) {
      console.log(`👁️ [REGEN HOTSPOTS ${requestId}] Processing page ${pageIndex + 1}...`);
      const positions = await extractMenuItemPositions(pdfImages[pageIndex]);
      positions.forEach((pos: any) => {
        pdfPositions.push({ ...pos, page: pageIndex });
      });
    }

    console.log(`✅ [REGEN HOTSPOTS ${requestId}] Found ${pdfPositions.length} positions`);

    // Match menu items to positions
    const newHotspots = [];
    for (const item of menuItems) {
      const posMatch = pdfPositions.find((pos: any) => 
        calculateSimilarity(item.name, pos.name) > 0.7
      );

      if (posMatch) {
        newHotspots.push({
          id: uuidv4(),
          venue_id: venueId,
          menu_item_id: item.id,
          page_index: posMatch.page,
          x_percent: posMatch.x,
          y_percent: posMatch.y,
          width_percent: posMatch.x2 - posMatch.x1,
          height_percent: posMatch.y2 - posMatch.y1,
          x1_percent: posMatch.x1,
          y1_percent: posMatch.y1,
          x2_percent: posMatch.x2,
          y2_percent: posMatch.y2,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }
    }

    console.log(`✅ [REGEN HOTSPOTS ${requestId}] Created ${newHotspots.length} new hotspots`);

    // Replace old hotspots
    await supabase.from('menu_hotspots').delete().eq('venue_id', venueId);
    
    if (newHotspots.length > 0) {
      await supabase.from('menu_hotspots').insert(newHotspots);
    }

    console.log(`✅ [REGEN HOTSPOTS ${requestId}] Success!`);

    return NextResponse.json({
      ok: true,
      result: {
        hotspots_created: newHotspots.length,
      },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Processing failed';
    console.error(`❌ [REGEN HOTSPOTS ${requestId}] Error:`, errorMessage);
    logger.error(`[REGEN HOTSPOTS ${requestId}] Error:`, { error: errorMessage });
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

