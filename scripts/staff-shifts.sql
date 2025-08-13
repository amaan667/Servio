-- Staff shifts schema (run once in Supabase)

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venues(venue_id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  area text,
  created_at timestamptz not null default now()
);

alter table public.staff_shifts enable row level security;

do $$ begin
  create policy "owner can manage shifts" on public.staff_shifts
  for all using (
    exists(select 1 from public.venues v where v.venue_id = staff_shifts.venue_id and v.owner_id = auth.uid())
  ) with check (
    exists(select 1 from public.venues v where v.venue_id = staff_shifts.venue_id and v.owner_id = auth.uid())
  );
exception when others then null; end $$;


