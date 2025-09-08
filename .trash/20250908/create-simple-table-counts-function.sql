-- Simple table counts function (without reservations table dependency)
-- Tables Set Up: Count of tables you've created and enabled in Table Management
-- In Use Now: Count of tables currently occupied

create or replace function public.simple_table_counts(
  p_venue_id text
) returns table(
  tables_set_up int,
  in_use_now int
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
  (select count(*) from cur where status = 'OCCUPIED')                            as in_use_now;
$$;

grant execute on function public.simple_table_counts(text) to anon, authenticated;

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
