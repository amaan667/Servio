-- Add timezone column to venues table
alter table public.venues
add column if not exists timezone text;

-- Set default timezone for existing venues
update public.venues set timezone = coalesce(timezone, 'Europe/London');

-- Create indexes for better performance
create index if not exists idx_orders_venue_created_at on public.orders (venue_id, created_at desc);
create index if not exists idx_orders_venue_status_created_at on public.orders (venue_id, status, created_at desc);
