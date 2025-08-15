-- Create order feedback table
create table if not exists public.order_feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.order_feedback enable row level security;

-- Create RLS policy
do $$ begin
  create policy "owner can read feedback" on public.order_feedback
  for select using (
    exists(select 1 from public.orders o
      join public.venues v on v.venue_id = o.venue_id
      where o.id = order_feedback.order_id and v.owner_id = auth.uid())
  );
exception when others then null; end $$;
