import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  const supa = admin();
  try {
    const { upload_id } = await req.json();
    if (!upload_id) return NextResponse.json({ ok: false, error: 'upload_id required' }, { status: 400 });
    const { data: row, error } = await supa.from('menu_uploads').select('*').eq('id', upload_id).maybeSingle();
    if (error || !row) { console.error('[MENU_COMMIT] fetch upload error', error); return NextResponse.json({ ok: false, error: error?.message || 'upload not found' }, { status: 404 }); }

    const parsed = row.parsed_json as any;
    if (!parsed?.categories) return NextResponse.json({ ok: false, error: 'no parsed categories' }, { status: 400 });

    const items: Array<{ venue_id: string; name: string; description: string | null; price: number; category: string; available: boolean }>= [];
    for (const cat of parsed.categories || []) {
      const catName = (cat?.name || 'Uncategorized') as string;
      for (const it of cat?.items || []) {
        const name = (it?.name || '').trim();
        const price = Number(it?.unit_price ?? it?.price ?? 0);
        if (!name || !(price > 0)) continue;
        items.push({ venue_id: row.venue_id, name, description: (it?.description ?? null), price, category: catName, available: true });
      }
    }

    if (!items.length) return NextResponse.json({ ok: false, error: 'no items to import' }, { status: 400 });

    // Upsert by (venue_id, name)
    const { data: inserted, error: insErr } = await supa
      .from('menu_items')
      .upsert(items, { onConflict: 'venue_id,name' })
      .select('id');
    if (insErr) { console.error('[MENU_COMMIT] upsert error', insErr); return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 }); }

    await supa.from('menu_uploads').update({ status: 'committed' }).eq('id', upload_id);
    return NextResponse.json({ ok: true, count: inserted?.length || 0 });
  } catch (e: any) {
    console.error('[MENU_COMMIT] fatal', e);
    return NextResponse.json({ ok: false, error: e?.message || 'commit failed' }, { status: 500 });
  }
}


