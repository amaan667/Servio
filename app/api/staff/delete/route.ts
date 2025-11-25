import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(()=>({ /* Empty */ }));

    // CRITICAL: Authentication check
    const { requireAuthForAPI } = await import('@/lib/auth/api');
    const authResult = await requireAuthForAPI();
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    // CRITICAL: Rate limiting
    const { rateLimit, RATE_LIMITS } = await import('@/lib/rate-limit');
    const rateLimitResult = await rateLimit(req as unknown as NextRequest, RATE_LIMITS.GENERAL);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.reset - Date.now()) / 1000)} seconds.`,
        },
        { status: 429 }
      );
    }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { createAdminClient } = await import("@/lib/supabase");
  const admin = createAdminClient();

  // Use soft deletion instead of hard deletion for forever count
  const { error } = await admin
    .from('staff')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
    
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

