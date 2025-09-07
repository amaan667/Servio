-- Fix the dashboard_counts function with correct logic
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
  in_use_now int,
  reserved_now int,
  reserved_later int,
  waiting int
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
  -- Tables Set Up: Count of tables you've created and enabled in Table Management
  -- Source: tables.is_active = true (regardless of orders)
  select count(*)::int c
  from public.tables t
  where t.venue_id = p_venue_id
    and t.is_active = true
),
-- Table state counters for comprehensive table management
table_counters as (
  select 
    count(*)::int as tables_set_up,
    count(case when ts.status = 'OCCUPIED' and ts.closed_at is null then 1 end)::int as in_use_now,
    0::int as reserved_now, -- Will be calculated separately
    0::int as reserved_later, -- Will be calculated separately
    0::int as waiting -- TODO: implement waiting list
  from public.tables t
  left join public.table_sessions ts on ts.table_id = t.id and ts.closed_at is null
  where t.venue_id = p_venue_id and t.is_active = true
),
reservation_counters as (
  select 
    count(distinct case when r.status = 'BOOKED' and r.start_at <= b.now_utc + interval '30 minutes' and r.start_at > b.now_utc then r.table_id end)::int as reserved_now,
    count(distinct case when r.status = 'BOOKED' and r.start_at > b.now_utc + interval '30 minutes' then r.table_id end)::int as reserved_later
  from public.reservations r
  inner join public.tables t on t.id = r.table_id
  where t.venue_id = p_venue_id and t.is_active = true
)
select
  live.c,
  earlier.c,
  hist.c,
  (select count(*)::int from today) as today_orders_count,
  active_tables.c,
  tc.tables_set_up,
  tc.in_use_now,
  COALESCE(rc.reserved_now, 0) as reserved_now,
  COALESCE(rc.reserved_later, 0) as reserved_later,
  tc.waiting
from live, earlier, hist, active_tables, table_counters tc, reservation_counters rc;
$$;

grant execute on function public.dashboard_counts(text,text,int) to anon, authenticated;
