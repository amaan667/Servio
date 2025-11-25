import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// GET /api/inventory/stock/movements?venue_id=xxx&limit=50&offset=0
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venue_id') || searchParams.get('venueId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const reason = searchParams.get('reason');

    if (!venueId) {
      return NextResponse.json(
        { error: 'venue_id is required' },
        { status: 400 }
      );
    }

    // CRITICAL: Authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
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

    const supabase = await createClient();

    let query = supabase
      .from('stock_ledgers')
      .select(`
        *,
        ingredient:ingredients(name, unit),
        user:created_by(email)
      `)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reason) {
      query = query.eq('reason', reason);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('[INVENTORY API] Error fetching movements:', { error: error instanceof Error ? error.message : 'Unknown error' });
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      pagination: {
        limit,
        offset,
        total: count || 0,
      },
    });
  } catch (_error) {
    logger.error('[INVENTORY API] Unexpected error:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

