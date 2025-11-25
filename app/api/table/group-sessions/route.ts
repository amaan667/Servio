import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = "nodejs";

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

      const venueId = context.venueId;

    const { createAdminClient } = await import("@/lib/supabase");
    const supabase = createAdminClient();

    try {
      // Get all active group sessions for this venue
      const { data: groupSessions, error } = await supabase
        .from('table_group_sessions')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_active', true)
        .order('table_number', { ascending: true });

      if (error) {
        if (error.message.includes('does not exist')) {
          return NextResponse.json({ 
            ok: true, 
            groupSessions: [],
            message: 'Table not created yet - returning empty data'
          });
        }
        logger.error('[GROUP SESSIONS] Error fetching group sessions:', { error: error instanceof Error ? error.message : 'Unknown error' });
        return NextResponse.json({ 
          ok: false, 
          error: `Failed to fetch group sessions: ${error.message}` 
        }, { status: 500 });
      }

      return NextResponse.json({ 
        ok: true, 
        groupSessions: groupSessions || [],
        count: groupSessions?.length || 0
      });

    } catch (tableError) {
      return NextResponse.json({ 
        ok: true, 
        groupSessions: [],
        message: 'Table not available - returning empty data'
      });
    }

    } catch (_error) {
      logger.error('[GROUP SESSIONS] Error in GET group sessions API:', { error: _error instanceof Error ? _error.message : 'Unknown error' });
      return NextResponse.json({ 
        ok: false, 
        error: 'Internal server error' 
      }, { status: 500 });
    }
  }
);
