-- Update dashboard_counts function to use new table management logic
-- This replaces the old "active_tables_count" with proper table management counts

-- Drop the existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS public.dashboard_counts(text, text, integer);

create or replace function public.dashboard_counts(
  p_venue_id text,
  p_tz text,
  p_live_window_mins int default 30
) returns table(
  live_count int,
  earlier_today_count int,
  history_count int,
  today_orders_count int,
  active_tables_count int,
  tables_set_up int,
  tables_in_use int,
  tables_reserved_now int
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
  select count(*)::int c
  from today t, b
  where t.status in ('PLACED','ACCEPTED','IN_PREP','READY','SERVING','SERVED','COMPLETED')
    and t.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
),
earlier as (
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
),
-- New table management counts
table_counts as (
  select
    (select count(*)::int from tables where venue_id = p_venue_id and is_active = true) as tables_set_up,
    (select count(*)::int 
     from table_sessions s
     join tables t on t.id = s.table_id
     where t.venue_id = p_venue_id 
       and t.is_active = true 
       and s.closed_at is null 
       and s.status = 'OCCUPIED') as tables_in_use,
    (select count(distinct r.table_id)::int
     from reservations r
     join tables t on t.id = r.table_id
     where t.venue_id = p_venue_id 
       and t.is_active = true
       and r.status = 'BOOKED' 
       and r.start_at <= now() 
       and r.end_at >= now()) as tables_reserved_now
)
select
  live.c,
  earlier.c,
  hist.c,
  (select count(*)::int from today) as today_orders_count,
  active_tables.c,
  table_counts.tables_set_up,
  table_counts.tables_in_use,
  table_counts.tables_reserved_now
from live, earlier, hist, active_tables, table_counts;
$$;

grant execute on function public.dashboard_counts(text,text,int) to anon, authenticated;
