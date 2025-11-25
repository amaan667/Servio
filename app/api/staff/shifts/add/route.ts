import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
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
      const { staff_id, start_time, end_time, area } = body;
      const venue_id = context.venueId || body.venue_id;

      if (!venue_id || !staff_id || !start_time || !end_time) {
        return NextResponse.json({ error:'Missing fields' }, { status:400 });
      }
      const { createAdminClient } = await import("@/lib/supabase");
      const admin = createAdminClient();
  const { data, error } = await admin.from('staff_shifts').insert([{ venue_id, staff_id, start_time, end_time, area }]).select('*');
  if (error) return NextResponse.json({ error: error.message }, { status:400 });
      return NextResponse.json({ ok:true, data });
    } catch (_error) {
      return NextResponse.json(
        { error: _error instanceof Error ? _error.message : "Internal server error" },
        { status: 500 }
      );
    }
  }
);

