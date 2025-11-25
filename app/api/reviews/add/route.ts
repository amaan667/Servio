import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase';
import { withUnifiedAuth } from '@/lib/auth/unified-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const Body = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export const POST = withUnifiedAuth(
  async (req: NextRequest, _context) => {
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

      const json = await req.json();
    const { orderId, rating, comment } = Body.parse(json);
    const admin = await createClient();
    const { data: order, error } = await admin
      .from('orders').select('id, venue_id').eq('id', orderId).maybeSingle();
    if (error || !order) return NextResponse.json({ ok:false, error: error?.message || 'Order not found' }, { status:404 });
    const { error: insErr } = await admin.from('reviews').insert({
      order_id: orderId,
      venue_id: order.venue_id,
      rating,
      comment: (comment ?? '').slice(0, 500),
    });
    if (insErr) return NextResponse.json({ ok:false, error: insErr.message }, { status:500 });
      return NextResponse.json({ ok:true });
    } catch (e:unknown) {
      return NextResponse.json({ ok:false, error: e instanceof Error ? e.message : 'Unknown error' }, { status:400 });
    }
  }
);

