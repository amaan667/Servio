import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  const supa = admin();
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const venueId = (form.get('venue_id') as string) || (form.get('venueId') as string) || '';
    if (!file || !venueId) {
      return NextResponse.json({ ok: false, error: 'file and venue_id are required' }, { status: 400 });
    }

    // Ensure bucket exists
    try {
      const { data: buckets } = await supa.storage.listBuckets();
      const has = (buckets || []).some((b: any) => b.name === 'menus');
      if (!has) {
        await supa.storage.createBucket('menus', { public: false });
      }
    } catch {}

    const arrayBuf = await file.arrayBuffer();
    const hash = await sha256(arrayBuf);
    const path = `${venueId}/${hash}.pdf`;

    // Check cache
    const { data: existing, error: selErr } = await supa
      .from('menu_uploads')
      .select('id, status')
      .eq('venue_id', venueId)
      .eq('sha256', hash)
      .maybeSingle();
    if (selErr) {
      // continue anyway
    }
    let uploadId: string | null = existing?.id ?? null;
    if (!existing) {
      const { error: upErr } = await supa.storage.from('menus').upload(path, new Blob([arrayBuf]), { upsert: true, contentType: 'application/pdf' });
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });

      const { data: ins, error: insErr } = await supa
        .from('menu_uploads')
        .insert({ venue_id: venueId, filename: `${hash}.pdf`, sha256: hash, status: 'uploaded' })
        .select('id')
        .maybeSingle();
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
      uploadId = ins?.id ?? null;
    }

    return NextResponse.json({ ok: true, upload_id: uploadId, sha256: hash, path });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'upload failed' }, { status: 500 });
  }
}


