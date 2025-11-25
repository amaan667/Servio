import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venue_id = searchParams.get('venue_id');

    if (!venue_id) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 });
    }

    // CRITICAL: Add authentication and venue access verification
    const venueAccessResult = await requireVenueAccessForAPI(venue_id);
    if (!venueAccessResult.success) {
      return venueAccessResult.response;
    }

    // CRITICAL: Add rate limiting
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

    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('venue_id', venue_id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, staff: data || [] });
  } catch (_e) {
    const errorMessage = _e instanceof Error ? _e.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
