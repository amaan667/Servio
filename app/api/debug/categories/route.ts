import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venueId');
    
    if (!venueId) {
      return NextResponse.json(
        { error: 'venueId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get all menu items with their categories
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, category')
      .eq('venue_id', venueId);

    if (menuError) {
      logger.error('[DEBUG CATEGORIES] Error fetching menu items:', menuError);
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500 }
      );
    }

    // Group by category to see what categories exist
    const categoryGroups: Record<string, unknown[]> = {};
    menuItems?.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      categoryGroups[cat].push({
        id: item.id,
        name: item.name
      });
    });

    return NextResponse.json({
      totalItems: menuItems?.length || 0,
      categories: Object.keys(categoryGroups),
      categoryGroups,
      sampleItems: menuItems?.slice(0, 5) || []
    });

  } catch (error) {
    logger.error('[DEBUG CATEGORIES] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
