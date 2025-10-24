import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface MenuItemLink {
  menu_item?: {
    name: string;
  } | {
    name: string;
  }[];
}

// GET /api/inventory/low-stock?venue_id=xxx
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const venue_id = searchParams.get('venue_id');

    if (!venue_id) {
      return NextResponse.json(
        { error: 'venue_id is required' },
        { status: 400 }
      );
    }

    // Get ingredients at or below reorder level
    const { data: lowStockItems, error } = await supabase
      .from('v_stock_levels')
      .select('*')
      .eq('venue_id', venue_id)
      .or('on_hand.lte.reorder_level,on_hand.lte.0')
      .order('on_hand', { ascending: true });

    if (error) {
      logger.error('[INVENTORY API] Error fetching low stock:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // For each low stock item, find affected menu items
    const alerts = await Promise.all(
      (lowStockItems || []).map(async (item) => {
        const { data: menuItems } = await supabase
          .from('menu_item_ingredients')
          .select('menu_item_id, menu_item:menu_items(name)')
          .eq('ingredient_id', item.ingredient_id);

        return {
          ingredient_id: item.ingredient_id,
          ingredient_name: item.name,
          current_stock: item.on_hand,
          reorder_level: item.reorder_level,
          unit: item.unit,
          affected_menu_items: menuItems?.map((mi: MenuItemLink) => {
            const menuItem = mi.menu_item;
            if (Array.isArray(menuItem)) {
              return menuItem[0]?.name;
            }
            return menuItem?.name;
          }).filter(Boolean) || [],
        };
      })
    );

    return NextResponse.json({ data: alerts });
  } catch (_error) {
    logger.error('[INVENTORY API] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

