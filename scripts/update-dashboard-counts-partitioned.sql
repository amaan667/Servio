-- Update dashboard_counts function to match new partitioning logic
-- This ensures orders appear in only one tab with proper precedence
create or replace function public.dashboard_counts(
  p_venue_id text,
  p_tz text,
  p_live_window_mins int default 30
) returns table(
  live_count int,
  today_count int,
  history_count int,
  today_orders_count int,
  active_tables_count int
)
language sql
stable
as $$
with b as (
  select
    timezone('UTC', date_trunc('day', timezone(p_tz, now())))                    as start_utc,
    timezone('UTC', date_trunc('day', timezone(p_tz, now())) + interval '1 day') as end_utc,
    now()                                                                        as now_utc
),
-- Live: Orders within last 30 minutes (regardless of status or day)
live as (
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
),
-- Today: Orders from today that are NOT in live window
today as (
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at >= b.start_utc
    and o.created_at < b.now_utc - make_interval(mins => p_live_window_mins)
),
-- History: Orders from before today
history as (
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at < b.start_utc
),
-- Total today orders (live + today)
today_total as (
  select count(*)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.created_at >= b.start_utc
    and o.created_at < b.end_utc
),
-- Active tables: Tables with live orders
active_tables as (
  select count(distinct o.table_number)::int c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.table_number is not null
    and o.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
)
select
  live.c,
  today.c,
  history.c,
  today_total.c,
  active_tables.c
from live, today, history, today_total, active_tables;
$$;

grant execute on function public.dashboard_counts(text,text,int) to anon, authenticated;
