import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase';
import { requireVenueAccessForAPI } from '@/lib/auth/api';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const Body = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {

    // CRITICAL: Authentication and venue access verification
    const { searchParams } = new URL(req.url);
    let venueId = searchParams.get('venueId') || searchParams.get('venue_id');
    
    if (!venueId) {
      try {
        const body = await req.clone().json();
        venueId = body?.venueId || body?.venue_id;
      } catch {
        // Body parsing failed
      }
    }
    
    if (venueId) {
      const venueAccessResult = await requireVenueAccessForAPI(venueId, req);
      if (!venueAccessResult.success) {
        return venueAccessResult.response;
      }
    } else {
      // Fallback to basic auth if no venueId
      const { requireAuthForAPI } = await import('@/lib/auth/api');
      const authResult = await requireAuthForAPI(req);
      if (authResult.error || !authResult.user) {
        return NextResponse.json(
          { error: 'Unauthorized', message: authResult.error || 'Authentication required' },
          { status: 401 }
        );
      }
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

