import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const venueId = searchParams.get('venueId');
  if (!venueId) return NextResponse.json({ ok:false, error:'venueId required' }, { status:400 });
  const admin = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false }});
  const { data, error } = await admin
    .from('reviews')
    .select('id, order_id, rating, comment, created_at')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
  return NextResponse.json({ ok:true, reviews: data });
}


