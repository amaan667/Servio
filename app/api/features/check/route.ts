import { NextRequest, NextResponse } from 'next/server';
import { checkFeatureAccess, PREMIUM_FEATURES } from '@/lib/feature-gates';
import { logger } from '@/lib/logger';

// GET /api/features/check?venue_id=xxx&feature=INVENTORY
export async function GET(_request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get('venue_id');
    const feature = searchParams.get('feature') as keyof typeof PREMIUM_FEATURES;

    if (!venueId || !feature) {
      return NextResponse.json(
        { error: 'venue_id and feature are required' },
        { status: 400 }
      );
    }

    if (!(feature in PREMIUM_FEATURES)) {
      return NextResponse.json(
        { error: 'Invalid feature' },
        { status: 400 }
      );
    }

    const requiredTier = PREMIUM_FEATURES[feature];
    const access = await checkFeatureAccess(venueId, requiredTier);

    return NextResponse.json(access);
  } catch (_error) {
    logger._error('[FEATURE CHECK API] Error:', { error: _error instanceof Error ? _error.message : 'Unknown _error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

