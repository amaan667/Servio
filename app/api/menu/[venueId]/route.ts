import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache/index';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  const startTime = Date.now();
  let rawVenueId = 'unknown';
  
  try {
    
    const params = await context.params;
    rawVenueId = params.venueId;
    
    
    if (!rawVenueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Handle venue ID format - ensure it has 'venue-' prefix for database lookup
    const venueId = rawVenueId.startsWith('venue-') ? rawVenueId : `venue-${rawVenueId}`;
    
    logger.debug('[MENU API] Looking up venue:', { data: { rawVenueId, transformedVenueId: venueId } });

    // Try to get from cache first
    const cacheKey = cacheKeys.menuItems(venueId);
    const cachedMenu = await cache.get(cacheKey);
    
    if (cachedMenu) {
      logger.debug('[MENU API] Cache hit for:', { value: venueId });
      const duration = Date.now() - startTime;
      return NextResponse.json(cachedMenu);
    }
    
    logger.debug('[MENU API] Cache miss for:', { value: venueId });

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
      logger.debug('[MENU API] Trying fallback venue lookup with original ID:', { value: rawVenueId });
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
      logger.error('[MENU API] Venue not found:', { error: { rawVenueId, transformedVenueId: venueId, error: venueError } });
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
      logger.error('[MENU API] Error fetching menu items:', { value: menuError });
      return NextResponse.json(
        { error: 'Failed to load menu items' },
        { status: 500 }
      );
    }
    
    if (menuItems && menuItems.length > 0) { /* Empty */ } else {
      // Intentionally empty
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
    await cache.set(cacheKey, response, { ttl: cacheTTL.medium });
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json(response);

  } catch (_error) {
    const duration = Date.now() - startTime;
    
    logger.error('[MENU API] Unexpected error:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      venueId: rawVenueId
    });
    
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
