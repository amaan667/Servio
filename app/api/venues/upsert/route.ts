import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookieAdapter } from '@/lib/server/supabase';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { name, business_type, address, phone } = await req.json().catch(() => ({}));
    if (!name || !business_type) {
      return NextResponse.json({ ok: false, error: 'name and business_type are required' }, { status: 400 });
    }

    const jar = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookieAdapter(jar) }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

    // Check if a venue already exists for this owner
    const { data: existing, error: checkErr } = await admin
      .from('venues')
      .select('venue_id')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (checkErr) return NextResponse.json({ ok: false, error: checkErr.message }, { status: 400 });

    if (existing) {
      const { data: updated, error: updErr } = await admin
        .from('venues')
        .update({ name, business_type, address: address || null, phone: phone || null })
        .eq('venue_id', existing.venue_id)
        .select('venue_id')
        .maybeSingle();
      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
      return NextResponse.json({ ok: true, venue_id: updated?.venue_id || existing.venue_id });
    }

    const venue_id = `venue-${user.id.slice(0, 8)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: inserted, error: insErr } = await admin
      .from('venues')
      .insert({ venue_id, name, business_type, address: address || null, phone: phone || null, owner_id: user.id })
      .select('venue_id')
      .maybeSingle();
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, venue_id: inserted?.venue_id || venue_id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}


