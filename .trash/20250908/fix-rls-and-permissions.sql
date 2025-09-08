-- Comprehensive fix for RLS and dashboard_counts function permissions
-- This fixes the 503 errors AND the tab counts showing 0

-- Step 1: Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Step 2: Create proper RLS policies for the orders table
-- Policy to allow authenticated users to read orders
DROP POLICY IF EXISTS "Allow authenticated users to read orders" ON public.orders;
CREATE POLICY "Allow authenticated users to read orders" ON public.orders
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy to allow service role to read all orders (for dashboard_counts function)
DROP POLICY IF EXISTS "Allow service role to read all orders" ON public.orders;
CREATE POLICY "Allow service role to read all orders" ON public.orders
    FOR SELECT
    TO service_role
    USING (true);

-- Policy to allow anon users to read orders (if needed for public access)
DROP POLICY IF EXISTS "Allow anon users to read orders" ON public.orders;
CREATE POLICY "Allow anon users to read orders" ON public.orders
    FOR SELECT
    TO anon
    USING (true);

-- Step 3: Fix the dashboard_counts function with SECURITY DEFINER
-- This allows the function to run with the privileges of the function creator
DROP FUNCTION IF EXISTS public.dashboard_counts(text, text, int);
CREATE OR REPLACE FUNCTION public.dashboard_counts(
  p_venue_id text,
  p_tz text,
  p_live_window_mins int default 30
) returns table(
  live_count int,
  earlier_today_count int,
  history_count int,
  today_orders_count int,
  active_tables_count int
)
language sql
stable
SECURITY DEFINER
as $$
with b as (
  select
    timezone('UTC', date_trunc('day', timezone(p_tz, now())))                    as start_utc,
    timezone('UTC', date_trunc('day', timezone(p_tz, now())) + interval '1 day') as end_utc,
    now()                                                                        as now_utc
),
-- normalize today's orders once (avoid inconsistent filters)
today as (
  select
    o.id,
    o.table_number,
    upper(o.order_status) as status,
    o.created_at
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at >= b.start_utc
    and o.created_at <  b.end_utc
),
live as (
  -- Orders that are currently active OR recently served/completed (≤ window)
  select count(*)::int c
  from today t, b
  where t.status in ('PLACED','ACCEPTED','IN_PREP','READY','SERVING','SERVED','COMPLETED')
    and t.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
),
earlier as (
  -- Orders from today that are NOT in the live set (today minus live window set)
  select count(*)::int c
  from today t, b
  where not (
    t.status in ('PLACED','ACCEPTED','IN_PREP','READY','SERVING','SERVED','COMPLETED')
    and t.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
  )
),
hist as (
  -- All orders from previous days (not just SERVED)
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at < b.start_utc
),
active_tables as (
  -- distinct tables that currently qualify as "live" (same 30-min window + active statuses)
  select count(distinct t.table_number)::int c
  from today t, b
  where t.table_number is not null
    and t.status in ('PLACED','ACCEPTED','IN_PREP','READY','SERVING')
    and t.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
)
select
  live.c,
  earlier.c,
  hist.c,
  (select count(*)::int from today) as today_orders_count,
  active_tables.c
from live, earlier, hist, active_tables;
$$;

-- Step 4: Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION public.dashboard_counts(text, text, int) TO anon, authenticated, service_role;

-- Step 5: Verify the setup
-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('orders', 'users', 'menu_items', 'order_items')
ORDER BY tablename;

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'orders'
ORDER BY tablename, policyname;

-- Test the dashboard_counts function
SELECT * FROM public.dashboard_counts('venue-1e02af4d', 'Europe/London', 30);
