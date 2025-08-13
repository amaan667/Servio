-- Staff management schema (run in Supabase SQL editor)

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venues(venue_id) on delete cascade,
  name text not null,
  role text not null default 'Server',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.staff enable row level security;

do $$ begin
  create policy "owner can manage staff" on public.staff
  for all using (
    exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_id = auth.uid())
  ) with check (
    exists(select 1 from public.venues v where v.venue_id = staff.venue_id and v.owner_id = auth.uid())
  );
exception when others then null; end $$;


