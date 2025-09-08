-- Ensure unique menu items per venue by (venue_id, name)
do $$ begin
  alter table public.menu_items
  add constraint menu_items_venue_name_unique unique (venue_id, name);
exception when others then null; end $$;

-- Optional helper to trim names on insert/update (not enforced here to avoid breaking app)

