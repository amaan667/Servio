import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(_request: NextRequest) {
  try {
    const { venue_id } = await request.json();

    if (!venue_id) {
      return NextResponse.json({ ok: false, error: 'venue_id is required' }, { status: 400 });
    }

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
        .select('*');

      if (error) {
        logger.error(`[AUTH DEBUG] Error clearing ${operation.description}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
        return NextResponse.json({ 
          ok: false, 
          error: `Failed to clear ${operation.description}: ${error.message}` 
        }, { status: 500 });
      }

      const deletedCount = count || 0;
      results[operation.table] = deletedCount;
      totalDeleted += deletedCount;
      
    }

    return NextResponse.json({
      ok: true,
      message: 'All catalog data cleared successfully',
      deletedCount: totalDeleted,
      details: results
    });

  } catch (error) {
    logger.error('[AUTH DEBUG] Clear menu error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: `Clear menu failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 });
  }
}
