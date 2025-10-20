import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';
import { apiLogger, logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId: rawVenueId } = await context.params;
    
    // Enhanced logging for customer menu access
    
    if (!rawVenueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Handle venue ID format - ensure it has 'venue-' prefix for database lookup
    const venueId = rawVenueId.startsWith('venue-') ? rawVenueId : `venue-${rawVenueId}`;
    
    logger.debug('[MENU API] Looking up venue:', { rawVenueId, transformedVenueId: venueId });

    // Try to get from cache first
    const cacheKey = cacheKeys.menuItems(venueId);
    const cachedMenu = await cache.get(cacheKey);
    
    if (cachedMenu) {
      logger.debug('[MENU API] Cache hit for:', venueId);
      return NextResponse.json(cachedMenu);
    }
    
    logger.debug('[MENU API] Cache miss for:', venueId);

    // Use admin client to bypass RLS for public menu access
    const supabase = createAdminClient();

    // First check if venue exists with transformed ID
    let { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, venue_name')
      .eq('venue_id', venueId)
      .single();

    // If not found with transformed ID, try with original ID as fallback
    if (venueError || !venue) {
      logger.debug('[MENU API] Trying fallback venue lookup with original ID:', rawVenueId);
      const { data: fallbackVenue, error: fallbackError } = await supabase
        .from('venues')
        .select('venue_id, venue_name')
        .eq('venue_id', rawVenueId)
        .single();
      
      if (!fallbackError && fallbackVenue) {
        venue = fallbackVenue;
        venueError = fallbackError;
      }
    }

    if (venueError || !venue) {
      logger.error('[MENU API] Venue not found:', { rawVenueId, transformedVenueId: venueId }, venueError);
      return NextResponse.json(
        { error: 'Venue not found', venueId: rawVenueId, searchedAs: venueId },
        { status: 404 }
      );
    }

    // Fetch menu items for the venue using the same venue_id that was found
    // Use created_at ordering as fallback since order_index column may not exist
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venue.venue_id)
      .eq('is_available', true)
      .order('created_at', { ascending: true });

    if (menuError) {
      logger.error('[MENU API] Error fetching menu items:', menuError);
      return NextResponse.json(
        { error: 'Failed to load menu items' },
        { status: 500 }
      );
    }

    // Return menu items with venue info
    const response = {
      venue: {
        id: venue.venue_id,
        name: venue.venue_name
      },
      menuItems: menuItems || [],
      totalItems: menuItems?.length || 0
    };

    // Cache the response for 5 minutes
    await cache.set(cacheKey, response, cacheTTL.menuItems);
    
    return NextResponse.json(response);

  } catch (error) {
    logger.error('[MENU API] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
