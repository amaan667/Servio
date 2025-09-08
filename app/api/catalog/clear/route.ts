import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { venueId } = await req.json();

    if (!venueId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId is required' 
      }, { status: 400 });
    }

    console.log('[CATALOG CLEAR] Clearing catalog for venue:', venueId);

    const supabase = await createAdminClient();

    // Verify venue exists
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id')
      .eq('venue_id', venueId)
      .single();

    if (venueError || !venue) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Venue not found' 
      }, { status: 404 });
    }

    // Clear all catalog data for this venue in the correct order (respecting FK constraints)
    const clearOperations = [
      { table: 'item_images', description: 'item images' },
      { table: 'item_aliases', description: 'item aliases' },
      { table: 'option_choices', description: 'option choices' },
      { table: 'options', description: 'options' },
      { table: 'menu_items', description: 'menu items' },
      { table: 'categories', description: 'categories' }
    ];

    let totalDeleted = 0;
    const results: Record<string, number> = {};

    for (const operation of clearOperations) {
      const { count, error } = await supabase
        .from(operation.table)
        .delete()
        .eq('venue_id', venueId)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`[CATALOG CLEAR] Error clearing ${operation.description}:`, error);
        return NextResponse.json({ 
          ok: false, 
          error: `Failed to clear ${operation.description}: ${error.message}` 
        }, { status: 500 });
      }

      const deletedCount = count || 0;
      results[operation.table] = deletedCount;
      totalDeleted += deletedCount;
      
      console.log(`[CATALOG CLEAR] Cleared ${deletedCount} ${operation.description}`);
    }

    console.log('[CATALOG CLEAR] Successfully cleared catalog:', results);

    return NextResponse.json({
      ok: true,
      message: 'Catalog cleared successfully',
      deletedCount: totalDeleted,
      details: results
    });

  } catch (error: any) {
    console.error('[CATALOG CLEAR] Unexpected error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Unexpected error: ' + error.message 
    }, { status: 500 });
  }
}
