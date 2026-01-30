-- Performance indexes for high-traffic queries (dashboard counts, venues, menu_items).
-- Safe to run: uses IF NOT EXISTS. Run without CONCURRENTLY inside migrations.

-- Dashboard: tables by venue
CREATE INDEX IF NOT EXISTS idx_tables_venue_id
  ON public.tables (venue_id);

-- Dashboard: table_sessions by venue + status + closed_at (occupied, open)
CREATE INDEX IF NOT EXISTS idx_table_sessions_venue_status_closed
  ON public.table_sessions (venue_id, status)
  WHERE closed_at IS NULL;

-- Dashboard: reservations by venue + status (booked, date range filtered in app)
CREATE INDEX IF NOT EXISTS idx_reservations_venue_status
  ON public.reservations (venue_id, status);

-- Dashboard + orders: orders by venue + created_at (today/live windows); exclude cancelled/refunded
CREATE INDEX IF NOT EXISTS idx_orders_venue_created_status
  ON public.orders (venue_id, created_at)
  WHERE order_status IS DISTINCT FROM 'CANCELLED' AND order_status IS DISTINCT FROM 'REFUNDED';

-- Top query: menu_items by venue_id + is_available
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_available
  ON public.menu_items (venue_id, is_available);

-- Top query: venues by venue_id (if not already PK)
CREATE INDEX IF NOT EXISTS idx_venues_venue_id
  ON public.venues (venue_id);
