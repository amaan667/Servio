import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { venue_id } = await request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

    console.log('[AUTH DEBUG] Clearing menu items for venue:', venue_id);

    const supabase = await createAdminClient();

    // Use the comprehensive catalog clear function
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
        .eq('venue_id', venue_id)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`[AUTH DEBUG] Error clearing ${operation.description}:`, error);
        return NextResponse.json({ 
          ok: false, 
          error: `Failed to clear ${operation.description}: ${error.message}` 
        }, { status: 500 });
      }

      const deletedCount = count || 0;
      results[operation.table] = deletedCount;
      totalDeleted += deletedCount;
      
      console.log(`[AUTH DEBUG] Cleared ${deletedCount} ${operation.description}`);
    }

    console.log('[AUTH DEBUG] Successfully cleared all catalog data for venue:', venue_id, 'Total deleted:', totalDeleted);

    return NextResponse.json({
      ok: true,
      message: 'All catalog data cleared successfully',
      deletedCount: totalDeleted,
      details: results
    });

  } catch (error) {
    console.error('[AUTH DEBUG] Clear menu error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Clear menu failed: ${error.message}` 
    }, { status: 500 });
  }
}
