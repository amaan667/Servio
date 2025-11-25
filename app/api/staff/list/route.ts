import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export const GET = withUnifiedAuth(
  async (req: NextRequest, context) => {
    try {
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

      const adminSupabase = createAdminClient();
      const { data, error } = await adminSupabase
        .from('staff')
        .select('*')
        .eq('venue_id', context.venueId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error("[STAFF LIST] Error fetching staff:", { error: error.message });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, staff: data || [] });
    } catch (_e) {
      const errorMessage = _e instanceof Error ? _e.message : 'Unknown error';
      logger.error("[STAFF LIST] Unexpected error:", { error: errorMessage });
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }
);
