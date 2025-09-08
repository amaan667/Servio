-- Enable realtime for orders table to ensure dashboard counts update in real-time
-- This is usually already set by Supabase, but safe to run to ensure it's configured

-- Enable realtime (usually already set by Supabase, but safe to run)
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- Verify realtime is enabled
select 
  schemaname,
  tablename,
  pubname
from pg_publication_tables 
where tablename in ('orders', 'order_items');
