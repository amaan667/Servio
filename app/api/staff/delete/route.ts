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

      const { id } = await req.json().catch(() => ({}));

      if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
      }

      const admin = createAdminClient();

      // Use soft deletion instead of hard deletion for forever count
      const { error } = await admin
        .from('staff')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('venue_id', context.venueId);
        
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      return NextResponse.json({ ok: true });
    } catch (_error) {
      return NextResponse.json(
        { error: _error instanceof Error ? _error.message : "Unknown error" },
        { status: 500 }
      );
    }
  }
);
