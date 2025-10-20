import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { venueId, targetLanguage = 'es' } = await request.json();
    
    if (!venueId) {
      return NextResponse.json(
        { error: 'venueId is required' },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    // Get all unique categories
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('category')
      .eq('venue_id', venueId);

    if (menuError) {
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500 }
      );
    }

    const uniqueCategories = Array.from(new Set(
      menuItems?.map(item => item.category).filter(Boolean) || []
    ));

    // Simple category translation mapping
    const categoryTranslations: Record<string, Record<string, string>> = {
      es: {
        'STARTERS': 'ENTRADAS',
        'MAINS': 'PLATOS PRINCIPALES',
        'DESSERTS': 'POSTRES',
        'DRINKS': 'BEBIDAS',
        'BRUNCH': 'DESAYUNO',
        'KIDS': 'NIÑOS',
        'SALAD': 'ENSALADAS',
        'WRAPS & SANDWICHES': 'WRAPS Y SÁNDWICHES'
      },
      en: {
        'ENTRADAS': 'STARTERS',
        'PLATOS PRINCIPALES': 'MAINS',
        'POSTRES': 'DESSERTS',
        'BEBIDAS': 'DRINKS',
        'DESAYUNO': 'BRUNCH',
        'NIÑOS': 'KIDS',
        'ENSALADAS': 'SALAD',
        'WRAPS Y SÁNDWICHES': 'WRAPS & SANDWICHES'
      }
    };

    const translations = categoryTranslations[targetLanguage] || {};
    let updatedCount = 0;

    // Update each category
    for (const category of uniqueCategories) {
      const translatedCategory = translations[category];
      if (translatedCategory && translatedCategory !== category) {
        const { error: updateError } = await supabase
          .from('menu_items')
          .update({ category: translatedCategory })
          .eq('venue_id', venueId)
          .eq('category', category);

        if (!updateError) {
          updatedCount++;
        } else {
          logger.error(`Failed to update category ${category}:`, updateError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} categories to ${targetLanguage}`,
      categoriesUpdated: updatedCount,
      totalCategories: uniqueCategories.length
    });

  } catch (error) {
    logger.error('[DEBUG TRANSLATE CATEGORIES] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
