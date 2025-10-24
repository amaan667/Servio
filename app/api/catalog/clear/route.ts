import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * Clear entire menu catalog for a venue
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId } = body;

    if (!venueId) {
      return NextResponse.json(
        { ok: false, error: 'venueId required' },
        { status: 400 }
      );
    }

    console.log('[CATALOG CLEAR] Clearing menu for venue:', venueId);

    const supabase = createAdminClient();

    // Delete menu items
    const { error: deleteItemsError, count: itemsCount } = await supabase
      .from('menu_items')
      .delete({ count: 'exact' })
      .eq('venue_id', venueId);

    if (deleteItemsError) {
      throw new Error(`Failed to delete items: ${deleteItemsError.message}`);
    }

    // Delete hotspots
    const { error: deleteHotspotsError } = await supabase
      .from('menu_hotspots')
      .delete()
      .eq('venue_id', venueId);

    if (deleteHotspotsError) {
      throw new Error(`Failed to delete hotspots: ${deleteHotspotsError.message}`);
    }

    // Delete uploads
    const { error: deleteUploadsError } = await supabase
      .from('menu_uploads')
      .delete()
      .eq('venue_id', venueId);

    if (deleteUploadsError) {
      throw new Error(`Failed to delete uploads: ${deleteUploadsError.message}`);
    }

    console.log(`✅ [CATALOG CLEAR] Cleared ${itemsCount || 0} items for venue:`, venueId);
    logger.info('[CATALOG CLEAR] Success:', { venueId, deletedCount: itemsCount });

    return NextResponse.json({
      ok: true,
      deletedCount: itemsCount || 0,
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Clear failed';
    console.error('[CATALOG CLEAR] Error:', errorMessage);
    logger.error('[CATALOG CLEAR] Error:', { error: errorMessage });
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

