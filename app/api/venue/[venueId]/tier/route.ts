import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ venueId: string }> }
) {
  try {
    const { venueId } = await context.params;
    
    if (!venueId) {
      return NextResponse.json(
        { error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get venue with organization data
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select(`
        venue_id,
        venue_name,
        organization_id,
        organizations (
          id,
          subscription_tier,
          subscription_status
        )
      `)
      .eq('venue_id', venueId)
      .single();

    if (venueError || !venue) {
      logger.error('[VENUE TIER API] Venue not found:', { venueId, error: venueError });
      return NextResponse.json(
        { 
          tier: 'basic',
          status: 'active'
        },
        { status: 200 }
      );
    }

    const organization = Array.isArray(venue.organizations) 
      ? venue.organizations[0] 
      : venue.organizations;

    return NextResponse.json({
      tier: organization?.subscription_tier || 'basic',
      status: organization?.subscription_status || 'active'
    });

  } catch (_error) {
    logger.error('[VENUE TIER API] Unexpected error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { 
        tier: 'basic',
        status: 'active'
      },
      { status: 200 }
    );
  }
}

