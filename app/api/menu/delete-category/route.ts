import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { venueId, categoryName } = await request.json();

    if (!venueId || !categoryName) {
      return NextResponse.json({ 
        ok: false, 
        error: 'venueId and categoryName are required' 
      }, { status: 400 });
    }


    const supabase = await createAdminClient();

    // First, check if this category has menu items
    const { data: menuItems, error: menuItemsError } = await supabase
      .from('menu_items')
      .select('id, name')
      .eq('venue_id', venueId)
      .eq('category', categoryName);

    if (menuItemsError) {
      logger.error('[CATEGORIES DELETE] Error fetching menu items:', menuItemsError);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to fetch menu items: ${menuItemsError.message}` 
      }, { status: 500 });
    }

    const itemsToDelete = menuItems || [];

    // Delete all menu items in this category
    if (itemsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('menu_items')
        .delete()
        .eq('venue_id', venueId)
        .eq('category', categoryName);

      if (deleteError) {
        logger.error('[CATEGORIES DELETE] Error deleting menu items:', deleteError);
        return NextResponse.json({ 
          ok: false, 
          error: `Failed to delete menu items: ${deleteError.message}` 
        }, { status: 500 });
      }
    }

    // Also delete related data (images, aliases, options, etc.)
    const relatedTables = ['item_images', 'item_aliases', 'option_choices', 'options'];
    
    for (const table of relatedTables) {
      try {
        // For tables that reference menu_items, we need to delete by menu item IDs
        if (table === 'item_images' || table === 'item_aliases' || table === 'option_choices') {
          if (itemsToDelete.length > 0) {
            const itemIds = itemsToDelete.map(item => item.id);
            const { error } = await supabase
              .from(table)
              .delete()
              .in('menu_item_id', itemIds);
            
            if (error) {
              logger.warn(`[CATEGORIES DELETE] Warning deleting from ${table}:`, error);
            }
          }
        } else if (table === 'options') {
          // Options table might have venue_id, delete by category
          const { error } = await supabase
            .from(table)
            .delete()
            .eq('venue_id', venueId)
            .eq('category', categoryName);
          
          if (error) {
            logger.warn(`[CATEGORIES DELETE] Warning deleting from ${table}:`, error);
          }
        }
      } catch (error) {
        logger.warn(`[CATEGORIES DELETE] Warning processing ${table}:`, error);
      }
    }


    return NextResponse.json({ 
      ok: true, 
      message: `Category "${categoryName}" and its items deleted successfully`,
      deletedItemsCount: itemsToDelete.length,
      deletedItems: itemsToDelete.map(item => item.name)
    });

  } catch (error) {
    logger.error('[CATEGORIES DELETE] Error in delete category API:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json({ 
      ok: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
