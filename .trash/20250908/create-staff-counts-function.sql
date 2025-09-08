-- Authoritative staff counts for staff management page
create or replace function public.staff_counts(
  p_venue_id text
) returns table(
  total_staff int,
  active_staff int,
  unique_roles int,
  active_shifts_count int
)
language sql
stable
as $$
with staff_data as (
  select
    s.id,
    s.active,
    s.role,
    s.created_at
  from public.staff s
  where s.venue_id = p_venue_id
),
-- Count all staff ever added (forever count) - includes inactive staff
total_staff_count as (
  select count(*)::int c
  from staff_data
),
-- Count only active staff
active_staff_count as (
  select count(*)::int c
  from staff_data
  where active = true
),
-- Count unique roles
unique_roles_count as (
  select count(distinct role)::int c
  from staff_data
  where active = true
),
-- Count active shifts (shifts happening now or in the future today)
active_shifts_count as (
  select count(*)::int c
  from public.staff_shifts ss
  where ss.venue_id = p_venue_id
    and ss.start_time <= now()
    and ss.end_time >= now()
)
select
  total_staff_count.c,
  active_staff_count.c,
  unique_roles_count.c,
  active_shifts_count.c
from total_staff_count, active_staff_count, unique_roles_count, active_shifts_count;
$$;
