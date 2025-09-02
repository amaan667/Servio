-- counts for: Live (active ≤ 30m), Earlier Today (today but not Live),
-- History (served before today). TZ-aware.
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
  where t.order_status in ('PLACED','IN_PREP','READY','SERVING')
    and t.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
),
earlier as (
  select count(*)::int as c
  from today_orders t, b
  where not (
      t.order_status in ('PLACED','IN_PREP','READY','SERVING')
  and t.created_at >= b.now_utc - make_interval(mins => p_live_window_mins)
  )
),
hist as (
  select count(*)::int as c
  from public.orders o, b
  where o.venue_id = p_venue_id
    and o.order_status = 'SERVED'
    and o.created_at < b.start_utc
)
select live.c, earlier.c, hist.c
from live, earlier, hist;
$$;

grant execute on function public.orders_tab_counts(text,text,int) to anon, authenticated;
