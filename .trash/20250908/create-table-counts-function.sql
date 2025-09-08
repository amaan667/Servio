-- Table counts function based on user requirements
-- Tables Set Up: Count of tables you've created and enabled in Table Management (i.e., can seat guests), regardless of orders.
-- Source: tables.is_active = true.
-- In Use Now: Count of tables currently occupied (and optionally include reserved if you want).
-- Source: the open table_sessions (and/or overlapping reservations if you want a "Reserved Now" chip).

create or replace function public.table_counts(
  p_venue_id text
) returns table(
  tables_set_up int,
  in_use_now int,
  reserved_now int
)
language sql
stable
as $$
with cur as (
  select s.table_id, s.status
  from table_sessions s
  join tables t on t.id = s.table_id
  where t.venue_id = p_venue_id
    and t.is_active = true
    and s.closed_at is null
)
select
  (select count(*) from tables t where t.venue_id = p_venue_id and t.is_active) as tables_set_up,
  (select count(*) from cur where status = 'OCCUPIED')                            as in_use_now,
  0 as reserved_now;  -- Set to 0 since reservations table doesn't exist yet
$$;

grant execute on function public.table_counts(text) to anon, authenticated;

-- Function to ensure FREE sessions for active tables
create or replace function ensure_free_session_for_active_tables()
returns void language plpgsql as $$
begin
  insert into table_sessions (venue_id, table_id, status)
  select t.venue_id, t.id, 'FREE'
  from tables t
  left join table_sessions s
    on s.table_id = t.id and s.closed_at is null
  where t.is_active = true and s.id is null;
end $$;

-- Safety check: enforce one open session per table
create unique index if not exists uniq_open_session_per_table
on table_sessions (table_id)
where closed_at is null;

