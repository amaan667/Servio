-- Update staff table to support soft deletion for forever count
-- Add deleted_at column to track when staff members were "removed"
alter table public.staff 
add column if not exists deleted_at timestamptz;

-- Create index for efficient filtering of non-deleted staff
create index if not exists idx_staff_deleted_at on public.staff(deleted_at);

-- Update the staff_counts function to properly handle soft deletion
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
    s.created_at,
    s.deleted_at
  from public.staff s
  where s.venue_id = p_venue_id
    and s.deleted_at is null  -- Only count non-deleted staff for active counts
),
-- Count all staff ever added (forever count) - includes deleted staff
total_staff_forever as (
  select count(*)::int c
  from public.staff s
  where s.venue_id = p_venue_id
    -- No deleted_at filter here - count ALL staff ever added
),
-- Count only active, non-deleted staff
active_staff_count as (
  select count(*)::int c
  from staff_data
  where active = true
),
-- Count unique roles from active, non-deleted staff
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
  total_staff_forever.c,
  active_staff_count.c,
  unique_roles_count.c,
  active_shifts_count.c
from total_staff_forever, active_staff_count, unique_roles_count, active_shifts_count;
$$;
