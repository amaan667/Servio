-- Fix the orders_tab_counts function to match the actual order query logic
-- This resolves the discrepancy between tab counts and actual order queries

-- Drop the existing function first
drop function if exists public.orders_tab_counts(text,text,int);

-- Create the corrected function
create or replace function public.orders_tab_counts(
  p_venue_id text,
  p_tz text,
  p_live_window_mins int default 30
) returns table(live_count int, earlier_today_count int, history_count int)
language sql
stable
as $$
with b as (
  select
    timezone('UTC', date_trunc('day', timezone(p_tz, now())))                      as start_utc,
    timezone('UTC', date_trunc('day', timezone(p_tz, now())) + interval '1 day')   as end_utc,
    now()                                                                          as now_utc
),
today_orders as (
  select o.id, o.order_status, o.created_at
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at >= b.start_utc and o.created_at < b.end_utc
),
live as (
  select count(*)::int as c
  from today_orders t, b
  where t.order_status in ('PLACED','IN_PREP','READY','SERVING','ACCEPTED','OUT_FOR_DELIVERY')
    and t.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
),
earlier as (
  select count(*)::int as c
  from today_orders t, b
  where t.order_status in ('SERVED','CANCELLED','REFUNDED','EXPIRED','COMPLETED')
    or (t.order_status in ('PLACED','IN_PREP','READY','SERVING','ACCEPTED','OUT_FOR_DELIVERY')
        and t.created_at < b.now_utc - make_interval(mins => p_live_window_mins))
),
hist as (
  select count(*)::int as c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at < b.start_utc
)
select live.c, earlier.c, hist.c
from live, earlier, hist;
$$;

-- Grant execute permissions
grant execute on function public.orders_tab_counts(text,text,int) to anon, authenticated;

-- Test the function with the venue from the logs
select 
  'Function created successfully' as status,
  (select * from public.orders_tab_counts('venue-1e02af4d', 'Europe/London', 30)) as test_result;
