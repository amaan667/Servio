import { NextRequest, NextResponse } from 'next/server';
import { checkFeatureAccess, PREMIUM_FEATURES } from '@/lib/feature-gates';
import { logger } from '@/lib/logger';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/features/check?venue_id=xxx&feature=INVENTORY
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    const feature = searchParams.get('feature') as keyof typeof PREMIUM_FEATURES;

    if (!venueId || !feature) {
      return NextResponse.json(
        { error: 'venue_id and feature are required' },
        { status: 400 }
      );
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Rate limiting
    const rateLimitResult = await rateLimit(req, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
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
    logger.error('[FEATURE CHECK API] Error:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

