-- Reviews table for post-order feedback
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

do $$ begin
  create policy "owner can read reviews" on public.reviews
  for select using (
    exists (
      select 1 from public.orders o
      join public.venues v on v.venue_id = o.venue_id
      where o.id = reviews.order_id and v.owner_id = auth.uid()
    )
  );
exception when others then null; end $$;


