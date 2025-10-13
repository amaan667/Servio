import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { enforceResourceLimit } from '@/lib/enforce-tier-limits';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient();
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

    const items: Array<{ venue_id: string; name: string; description: string | null; price: number; category: string; is_available: boolean }>= [];
    
    // Extract category order from parsed data
    const categoryOrder = parsed.categories?.map((cat: any) => cat?.name || 'Uncategorized') || [];
    
    for (const cat of parsed.categories || []) {
      const catName = (cat?.name || 'Uncategorized') as string;
      for (const it of cat?.items || []) {
        const name = (it?.name || '').trim();
        const price = Number(it?.unit_price ?? it?.price ?? 0);
        if (!name || !(price > 0)) continue;
        items.push({ venue_id: row.venue_id, name, description: (it?.description ?? null), price, category: catName, is_available: true });
      }
    }

    if (!items.length) return NextResponse.json({ ok: false, error: 'no items to import' }, { status: 400 });

    // Check tier limits before importing
    const authSupa = await createClient();
    const { data: { user } } = await authSupa.auth.getUser();
    
    if (user) {
      const { data: currentItems } = await supa.from('menu_items').select('id', { count: 'exact' }).eq('venue_id', row.venue_id);
      const currentCount = currentItems?.length || 0;
      const newTotal = currentCount + items.length;
      
      const tierCheck = await enforceResourceLimit(user.id, row.venue_id, "maxMenuItems", newTotal);
      if (!tierCheck.allowed && tierCheck.response) {
        return tierCheck.response;
      }
    }

    // Insert while avoiding duplicates without relying on DB constraint
    const { data: existing } = await supa.from('menu_items').select('name').eq('venue_id', row.venue_id);
    const existingNames = new Set((existing||[]).map((r:any)=>String(r.name||'').toLowerCase()));
    const toInsert = items.filter(i=>!existingNames.has(String(i.name).toLowerCase()));
    const { data: inserted, error: insErr } = await supa
      .from('menu_items')
      .insert(toInsert)
      .select('id');
    if (insErr) { console.error('[MENU_COMMIT] insert error', insErr); return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 }); }

    // Update the upload record with committed status and store the original category order
    await supa.from('menu_uploads').update({ 
      status: 'committed',
      category_order: categoryOrder
    }).eq('id', upload_id);
    
    return NextResponse.json({ ok: true, count: inserted?.length || 0, categoryOrder });
  } catch (e: any) {
    console.error('[MENU_COMMIT] fatal', e);
    return NextResponse.json({ ok: false, error: e?.message || 'commit failed' }, { status: 500 });
  }
}


