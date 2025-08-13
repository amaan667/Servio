import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ ok:false, error:'Missing service role key' }, { status:500 });

  const admin = createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
  const sql = `
  create table if not exists public.staff (
    id uuid primary key default gen_random_uuid(),
    venue_id text not null references public.venues(venue_id) on delete cascade,
    name text not null,
    role text not null default 'Server',
    active boolean not null default true,
    created_at timestamptz not null default now()
  );
  alter table public.staff enable row level security;
  do $$ begin
    create policy "owner can manage staff" on public.staff
    for all using (
      exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_id = auth.uid())
    ) with check (
      exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_id = auth.uid())
    );
  exception when others then null; end $$;`;

  try {
    const { error } = await admin.rpc('exec_sql', { sql });
    if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message || 'RPC exec failed' }, { status:500 });
  }
}


