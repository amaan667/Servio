import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache/index';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  const startTime = Date.now();
  let rawVenueId = 'unknown';
  
  try {
    console.log('🔍 [MENU API START] ========================================');
    console.log('🔍 [MENU API] Request URL:', request.url);
    console.log('🔍 [MENU API] Timestamp:', new Date().toISOString());
    
    const params = await context.params;
    rawVenueId = params.venueId;
    
    console.log('🔍 [MENU API] Raw Venue ID from params:', rawVenueId);
    
    if (!rawVenueId) {
      console.error('❌ [MENU API] No venue ID provided');
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Handle venue ID format - ensure it has 'venue-' prefix for database lookup
    const venueId = rawVenueId.startsWith('venue-') ? rawVenueId : `venue-${rawVenueId}`;
    
    console.log('🔍 [MENU API] Transformed Venue ID:', venueId);
    logger.debug('[MENU API] Looking up venue:', { data: { rawVenueId, transformedVenueId: venueId } });

    // Try to get from cache first
    console.log('💾 [MENU API] Checking cache for:', venueId);
    const cacheKey = cacheKeys.menuItems(venueId);
    const cachedMenu = await cache.get(cacheKey);
    
    if (cachedMenu) {
      console.log('✅ [MENU API] Cache HIT - returning cached data');
      logger.debug('[MENU API] Cache hit for:', { value: venueId });
      const duration = Date.now() - startTime;
      console.log(`⏱️ [MENU API] Request completed in ${duration}ms (cached)`);
      return NextResponse.json(cachedMenu);
    }
    
    console.log('❌ [MENU API] Cache MISS - fetching from database');
    logger.debug('[MENU API] Cache miss for:', { value: venueId });

    // Use admin client to bypass RLS for public menu access
    console.log('🔐 [MENU API] Creating admin client...');
    const supabase = createAdminClient();
    console.log('✅ [MENU API] Admin client created');

    // First check if venue exists with transformed ID
    console.log('🏢 [MENU API] Querying venues table with ID:', venueId);
    let { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('venue_id, venue_name')
      .eq('venue_id', venueId)
      .single();

    console.log('🏢 [MENU API] Initial venue query result:', {
      found: !!venue,
      error: venueError?.message || 'none',
      venueName: venue?.venue_name || 'n/a'
    });

    // If not found with transformed ID, try with original ID as fallback
    if (venueError || !venue) {
      console.log('🔄 [MENU API] Trying fallback with original ID:', rawVenueId);
      logger.debug('[MENU API] Trying fallback venue lookup with original ID:', { value: rawVenueId });
      const { data: fallbackVenue, error: fallbackError } = await supabase
        .from('venues')
        .select('venue_id, venue_name')
        .eq('venue_id', rawVenueId)
        .single();
      
      console.log('🔄 [MENU API] Fallback query result:', {
        found: !!fallbackVenue,
        error: fallbackError?.message || 'none'
      });
      
      if (!fallbackError && fallbackVenue) {
        venue = fallbackVenue;
        venueError = fallbackError;
      }
    }

    if (venueError || !venue) {
      console.error('❌ [MENU API] VENUE NOT FOUND');
      console.error('❌ [MENU API] Raw ID:', rawVenueId);
      console.error('❌ [MENU API] Transformed ID:', venueId);
      console.error('❌ [MENU API] Error:', venueError);
      logger.error('[MENU API] Venue not found:', { error: { rawVenueId, transformedVenueId: venueId, error: venueError } });
      return NextResponse.json(
        { error: 'Venue not found', venueId: rawVenueId, searchedAs: venueId },
        { status: 404 }
      );
    }
    
    console.log('✅ [MENU API] Venue found:', venue.venue_name);

    // Fetch menu items for the venue using the same venue_id that was found
    // Use created_at ordering as fallback since order_index column may not exist
    console.log('📋 [MENU API] Fetching menu items for venue:', venue.venue_id);
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('*')
      .eq('venue_id', venue.venue_id)
      .eq('is_available', true)
      .order('created_at', { ascending: true });

    console.log('📋 [MENU API] Menu items query result:', {
      count: menuItems?.length || 0,
      error: menuError?.message || 'none'
    });

    if (menuError) {
      console.error('❌ [MENU API] ERROR fetching menu items:', menuError);
      logger.error('[MENU API] Error fetching menu items:', { value: menuError });
      return NextResponse.json(
        { error: 'Failed to load menu items' },
        { status: 500 }
      );
    }
    
    if (menuItems && menuItems.length > 0) {
      console.log('✅ [MENU API] Found', menuItems.length, 'menu items');
    } else {
      console.log('⚠️ [MENU API] No menu items found for this venue');
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

    console.log('💾 [MENU API] Caching response...');
    // Cache the response for 5 minutes
    await cache.set(cacheKey, response, { ttl: cacheTTL.medium });
    console.log('✅ [MENU API] Response cached');
    
    const duration = Date.now() - startTime;
    console.log(`⏱️ [MENU API] Request completed in ${duration}ms`);
    console.log('✅ [MENU API SUCCESS] ========================================');
    
    return NextResponse.json(response);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌❌❌ [MENU API] UNEXPECTED ERROR ❌❌❌');
    console.error('❌ [MENU API] Venue ID:', rawVenueId);
    console.error('❌ [MENU API] Error Type:', error?.constructor?.name);
    console.error('❌ [MENU API] Error Message:', error instanceof Error ? error.message : String(error));
    console.error('❌ [MENU API] Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('❌ [MENU API] Full Error Object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error(`❌ [MENU API] Failed after ${duration}ms`);
    console.error('❌❌❌ [MENU API END] ========================================');
    
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
