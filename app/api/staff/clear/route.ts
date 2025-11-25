import { NextResponse } from 'next/server';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export const POST = withUnifiedAuth(
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

      const body = await req.json();
      const venue_id = context.venueId || body.venue_id;

      if (!venue_id) {
        return NextResponse.json({ error: 'venue_id required' }, { status: 400 });
      }
  const { createAdminClient } = await import("@/lib/supabase");
  const admin = createAdminClient();

  const { error } = await admin.from('staff').delete().eq('venue_id', venue_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    } catch (_error) {
      return NextResponse.json(
        { error: _error instanceof Error ? _error.message : "Internal server error" },
        { status: 500 }
      );
    }
  }
);

