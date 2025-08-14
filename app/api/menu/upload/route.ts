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
    console.log('[MENU_UPLOAD] start', {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const venueId = (form.get('venue_id') as string) || (form.get('venueId') as string) || '';
    if (!file || !venueId) {
      return NextResponse.json({ ok: false, error: 'file and venue_id are required' }, { status: 400 });
    }

    // Ensure table + RLS exists (idempotent)
    try {
      // Use a lightweight insert-select approach to avoid ts complaints; Supabase JS doesn't support arbitrary SQL without a function.
      // Expect this to fail harmlessly if a security defers creation; DDL should be applied via scripts as the primary path.
      await supa.from('menu_uploads' as any).select('id').limit(1);
    } catch (e) {
      console.warn('[MENU_UPLOAD] menu_uploads not accessible yet');
    }
    // Note: primary table creation should be done via scripts/menu-upload-schema.sql
    // Included here as documentation for desired RLS settings:
    /*
    create extension if not exists pgcrypto;
    create table if not exists public.menu_uploads (
      id uuid primary key default gen_random_uuid(),
      venue_id text not null references public.venues(venue_id) on delete cascade,
      filename text not null,
      sha256 text not null,
      pages int,
      status text default 'uploaded',
      ocr_used boolean default false,
      raw_text text,
      parsed_json jsonb,
      error text,
      created_at timestamptz default now(),
      unique (venue_id, sha256)
    );
    alter table public.menu_uploads enable row level security;
    */
    
    

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
      console.error('[MENU_UPLOAD] select cache error', selErr);
    }
    let uploadId: string | null = existing?.id ?? null;
    if (!existing) {
      const { error: upErr } = await supa.storage.from('menus').upload(path, new Blob([arrayBuf]), { upsert: true, contentType: 'application/pdf' });
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });

      const { data: ins, error: insErr } = await supa
        .from('menu_uploads')
        .insert({ venue_id: venueId, filename: path, sha256: hash, status: 'uploaded' })
        .select('id')
        .maybeSingle();
      if (insErr) {
        console.error('[MENU_UPLOAD] insert error', insErr);
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
      }
      uploadId = ins?.id ?? null;
    }

    return NextResponse.json({ ok: true, upload_id: uploadId, sha256: hash, path });
  } catch (e: any) {
    console.error('[MENU_UPLOAD] fatal', e);
    return NextResponse.json({ ok: false, error: e?.message || 'upload failed' }, { status: 500 });
  }
}


