-- Create storage bucket 'menus' manually in Supabase dashboard if needed

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

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename='menu_uploads' and policyname='owner can manage menu uploads'
  ) then
    create policy "owner can manage menu uploads"
    on public.menu_uploads
    for all
    using (
      exists (
        select 1 from public.venues v
        where v.venue_id = menu_uploads.venue_id
          and v.owner_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.venues v
        where v.venue_id = menu_uploads.venue_id
          and v.owner_id = auth.uid()
      )
    );
  end if;
end $$;


