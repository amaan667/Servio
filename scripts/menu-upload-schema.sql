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


